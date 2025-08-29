import { distance } from '@turf/distance';
import { generateShadeMap, SHADE_TYPE } from './shadowShader';
import { ShadowSampler } from './shadowSampler';
import path from 'ngraph.path';
import createGraph from 'ngraph.graph';

// Progress status enum
export const ROUTE_PROGRESS_STATUS = {
  GETTING_WAYS_DATA: 'GETTING_WAYS_DATA',
  COMPUTING_SHADE_MAP: 'COMPUTING_SHADE_MAP',
  BUILDING_GRAPH: 'BUILDING_GRAPH',
  APPLYING_SHADE_DATA: 'APPLYING_SHADE_DATA',
  FINDING_ROUTE: 'FINDING_ROUTE',
  ROUTE_COMPLETED: 'ROUTE_COMPLETED'
};

// Progress status to message mapping
export const getProgressMessage = (status) => {
  const messageMap = {
    [ROUTE_PROGRESS_STATUS.GETTING_WAYS_DATA]: 'Getting ways data...',
    [ROUTE_PROGRESS_STATUS.COMPUTING_SHADE_MAP]: 'Computing shade map...',
    [ROUTE_PROGRESS_STATUS.BUILDING_GRAPH]: 'Building graph...',
    [ROUTE_PROGRESS_STATUS.FINDING_ROUTE]: 'Finding route...',
    [ROUTE_PROGRESS_STATUS.ROUTE_COMPLETED]: 'Route completed'
  };
  return messageMap[status] || 'Processing...';
};

async function getWaysData(bounds, onProgress) {
  if (onProgress) onProgress(ROUTE_PROGRESS_STATUS.GETTING_WAYS_DATA);
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:180];(way["highway"]["area"!~"yes"]["access"!~"private"]["highway"!~"abandoned|bus_guideway|construction|cycleway|motor|no|planned|platform|proposed|raceway|razed|rest_area|services"]["foot"!~"no"]["service"!~"private"]["sidewalk"!~"separate"]["sidewalk:both"!~"separate"]["sidewalk:left"!~"separate"]["sidewalk:right"!~"separate"](${bbox});>;);out;`;
  const overpassUrl = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(overpassUrl, {
    method: 'POST',
    body: query,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
  if (!response.ok) {
    throw new Error(`Overpass API request failed: ${response.status}`);
  }
  return await response.json();
}

async function getShadeData(bounds, date, onProgress) {
  if (!bounds) return;

  try {
    if (onProgress) onProgress(ROUTE_PROGRESS_STATUS.COMPUTING_SHADE_MAP);
    const startTime = performance.now();
    const shadeMapResult = await generateShadeMap(bounds, date, SHADE_TYPE.IMAGE);
    console.log('Shade map generated:', shadeMapResult);
    const endTime = performance.now() - startTime;
    console.log(`Shade map computation time: ${endTime.toFixed(1)} ms`);
    return shadeMapResult;
  } catch (error) {
    console.error('Error generating shade map:', error);
  }
};

function getBboxForPoints(start, end) {
  const padding = 0.005; // roughly 500 meters
  return {
    west: Math.min(start.lng, end.lng) - padding,
    east: Math.max(start.lng, end.lng) + padding,
    north: Math.max(start.lat, end.lat) + padding,
    south: Math.min(start.lat, end.lat) - padding
  };
}

export async function findWalkingRoute(start, end, date, options = {}) {
  const { onProgress, ...routingOptions } = options;
  
  const bounds = getBboxForPoints(start, end);
  const waysData = await getWaysData(bounds, onProgress);
  const shadeData = await getShadeData(bounds, date, onProgress);
  const graph = await buildGraph(waysData, shadeData, onProgress);
  
  if (onProgress) onProgress(ROUTE_PROGRESS_STATUS.FINDING_ROUTE);
  const route = findRoute(graph, {
    latitude: start.lat,
    longitude: start.lng
  }, {
    latitude: end.lat,
    longitude: end.lng
  }, routingOptions);
  
  if (onProgress) onProgress(ROUTE_PROGRESS_STATUS.ROUTE_COMPLETED);
  return route;
};

export async function buildGraph(waysData, shadeData = null, onProgress) {
  if (onProgress) onProgress(ROUTE_PROGRESS_STATUS.BUILDING_GRAPH);
  const startTime = performance.now();
  const elements = waysData.elements;
  const nodes = new Map(); // osmNodeId -> {lat, lon, idx}
  let idxCounter = 0;

  // Helper function to yield to main thread
  const yieldToMainThread = () => new Promise(resolve => setTimeout(resolve, 0));

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === "node") {
      nodes.set(el.id, {
        lat: el.lat,
        lon: el.lon,
        idx: idxCounter++,
        osmId: el.id
      });
    }
    // Yield every 100 elements to prevent blocking
    if (i % 100 === 0) {
      await yieldToMainThread();
    }
  }

  // Phase 2: Define walkable way filter
  const isWalkable = (way) => {
    const tags = way.tags || {};

    // Must have highway tag
    if (!tags.highway) return false;

    // Check access restrictions
    if (tags.access === "private" && tags.foot !== "yes") return false;
    if (tags.access === "no" && tags.foot !== "yes") return false;
    if (tags.foot === "no") return false;

    // Walkable highway types
    const walkableHighways = [
      'footway', 'path', 'pedestrian', 'steps', 'cycleway',
      'residential', 'living_street', 'service', 'track',
      'primary', 'secondary', 'tertiary', 'unclassified',
      'primary_link', 'secondary_link', 'tertiary_link'
    ];

    return walkableHighways.includes(tags.highway);
  };

  // Phase 3: Create ngraph instance and initialize metadata structures
  const ngraphInstance = createGraph();
  const coords = new Array(nodes.size);     // idx -> [lat, lon]
  const nodeOsmIds = new Array(nodes.size); // idx -> osmId for debugging

  // Add nodes to ngraph and fill coordinate arrays
  let nodeCount = 0;
  for (const [osmId, nodeData] of nodes) {
    if (nodeData.idx >= coords.length) {
      continue;
    }
    coords[nodeData.idx] = [nodeData.lat, nodeData.lon];
    nodeOsmIds[nodeData.idx] = osmId;
    
    // Add node to ngraph with coordinate data
    ngraphInstance.addNode(nodeData.idx, { 
      coords: [nodeData.lat, nodeData.lon],
      osmId: osmId
    });
    
    // Yield every 100 nodes to prevent blocking
    if (nodeCount % 100 === 0) {
      await yieldToMainThread();
    }
    nodeCount++;
  }

  // Phase 4: Build edges from walkable ways
  let edgeSeq = 0;
  const edgesMeta = [];
  let waysProcessed = 0;
  let edgesCreated = 0;

  for (let elementIdx = 0; elementIdx < elements.length; elementIdx++) {
    const el = elements[elementIdx];
    if (el.type !== "way" || !isWalkable(el)) continue;

    waysProcessed++;

    // Filter way nodes to only include those we have coordinates for
    const validNodes = el.nodes.filter(nodeId => nodes.has(nodeId));

    if (validNodes.length < 2) {
      console.warn(`Way ${el.id} has fewer than 2 valid nodes, skipping`);
      continue;
    }

    // Create edges between consecutive nodes in the way
    for (let i = 0; i < validNodes.length - 1; i++) {
      const nodeAId = validNodes[i];
      const nodeBId = validNodes[i + 1];

      const nodeA = nodes.get(nodeAId);
      const nodeB = nodes.get(nodeBId);

      // Safety check (should not happen with filtered nodes)
      if (!nodeA || !nodeB) {
        continue;
      }

      // Additional safety check for node indices
      if (nodeA.idx === undefined || nodeB.idx === undefined) {
        continue;
      }

      if (nodeA.idx >= coords.length || nodeB.idx >= coords.length || nodeA.idx < 0 || nodeB.idx < 0) {
        continue;
      }

      // Calculate edge length
      const length = distance([nodeA.lon, nodeA.lat], [nodeB.lon, nodeB.lat], { units: 'meters' });

      if (length === 0) {
        console.warn(`Zero-length edge in way ${el.id} between nodes ${nodeAId} and ${nodeBId}`);
        continue;
      }

      const eid = edgeSeq++;
      edgesMeta.push({
        eid,
        a: nodeA.idx,
        b: nodeB.idx,
        wayOsmId: el.id,
        length,
        highway: el.tags?.highway,
        name: el.tags?.name
      });

      // Most streets are bidirectional for pedestrians unless explicitly one-way
      const isOneway = el.tags?.oneway === "yes" ||
        el.tags?.oneway === "true" ||
        el.tags?.oneway === "1";

      // Add forward direction edge to ngraph
      ngraphInstance.addLink(nodeA.idx, nodeB.idx, {
        eid: eid,
        length: length,
        wayOsmId: el.id,
        highway: el.tags?.highway,
        name: el.tags?.name
      });

      edgesCreated++;

      // Add reverse direction (if not one-way)
      if (!isOneway) {
        ngraphInstance.addLink(nodeB.idx, nodeA.idx, {
          eid: eid,
          length: length,
          wayOsmId: el.id,
          highway: el.tags?.highway,
          name: el.tags?.name
        });
        edgesCreated++;
      }
    }

    // Yield every 100 ways to prevent blocking
    if (waysProcessed % 100 === 0) {
      await yieldToMainThread();
    }
  }

  const shadeByEdgeId = new Map();
  const shadowSampler = new ShadowSampler(shadeData);
  if (shadeData) {
    for (let edgeIdx = 0; edgeIdx < edgesMeta.length; edgeIdx++) {
      const { eid, a, b } = edgesMeta[edgeIdx];
      const [latA, lonA] = coords[a];
      const [latB, lonB] = coords[b];

      const shadeValue = shadowSampler.sampleAlongLine(latA, lonA, latB, lonB);
      shadeByEdgeId.set(eid, shadeValue);

      // Yield every 100 edges to prevent blocking
      if (edgeIdx % 100 === 0) {
        await yieldToMainThread();
      }
    }

    // Update ngraph links with shade data
    ngraphInstance.forEachLink(link => {
      const shade = shadeByEdgeId.get(link.data.eid) ?? 0;
      link.data.shade = shade;
    });
  } else {
    // If no shade data, set all edges to 0 shade
    ngraphInstance.forEachLink(link => {
      link.data.shade = 0.0;
      shadeByEdgeId.set(link.data.eid, 0.0);
    });
  }

  // Return enhanced graph structure with both ngraph instance and legacy compatibility
  const graph = {
    ngraph: ngraphInstance,
    coords: coords,
    nodeOsmIds: nodeOsmIds,
    shadeByEdgeId: shadeByEdgeId,
    edgesMeta: edgesMeta,
    // Legacy adjacency list for backward compatibility if needed
    adj: Array.from({ length: nodes.size }, () => [])
  };

  // Fill legacy adjacency list for backward compatibility
  ngraphInstance.forEachLink(link => {
    if (!graph.adj[link.fromId]) graph.adj[link.fromId] = [];
    graph.adj[link.fromId].push({
      to: link.toId,
      length: link.data.length,
      eid: link.data.eid,
      wayOsmId: link.data.wayOsmId,
      highway: link.data.highway,
      shade: link.data.shade ?? 0
    });
  });

  const endTime = performance.now() - startTime;
  console.log(`Graph built: ${nodes.size} nodes, ${edgesCreated} edges from ${waysProcessed} ways`);
  console.log(`Graph construction time: ${endTime.toFixed(1)} ms`);

  return graph;
}

// A* pathfinding algorithm with shade-aware cost function using ngraph.path
function astar(graph, startIdx, goalIdx, opts = {}) {
  const {
    walkSpeed = 1.4,   // m/s (~5.0 km/h)
    shadePreference = 0.0, // 0 = no preference, 1 = strong shade preference
    pedestrianPathPreference = 0.2 // 0 = no preference, 1 = strong pedestrian path preference
  } = opts;

  // Use the pre-built ngraph instance from buildGraph
  const ngraphInstance = graph.ngraph;

  // Create custom heuristic function
  const goalCoords = graph.coords[goalIdx];
  if (!goalCoords) {
    return { path: [], time_s: Infinity, edges: [], distance: 0 };
  }
  const [goalLat, goalLon] = goalCoords;
  
  const heuristic = (fromNodeId, toNodeId) => {
    // fromNodeId is the actual node ID, not a node object
    const coords = graph.coords[fromNodeId];
    if (!coords) return 0; // Safety check
    const [lat, lon] = coords;
    const dist = distance([lon, lat], [goalLon, goalLat], { units: 'meters' });
    return dist / walkSpeed; // optimistic time estimate
  };

  // Custom distance function that calculates weights based on preferences
  const customDistance = (fromNode, toNode, link) => {
    const shade = link.data.shade ?? 0; // 0 = no shade, 1 = full shade
    
    // Pedestrian-only path preference (lower cost multiplier = higher preference)
    const isPedestrianOnly = ['footway', 'path', 'pedestrian', 'steps'].includes(link.data.highway);
    const pathTypeMultiplier = isPedestrianOnly ? (1 - pedestrianPathPreference) : 1.0;
    
    const baseTime = link.data.length / walkSpeed;
    const shadeMultiplier = 1 + shadePreference * (1 - shade);
    const edgeTime = baseTime * pathTypeMultiplier * shadeMultiplier;
    
    return edgeTime;
  };

  // Create pathfinder with custom distance and heuristic
  const pathFinder = path.aStar(ngraphInstance, {
    distance: customDistance,
    heuristic: heuristic
  });

  // Find path
  const foundPath = pathFinder.find(startIdx, goalIdx);

  if (!foundPath || foundPath.length === 0) {
    return { path: [], time_s: Infinity, edges: [], distance: 0 };
  }

  // Extract path and calculate metrics
  const pathNodes = foundPath.map(pathNode => pathNode.id);
  const edges = [];
  const edgeShadeValues = [];
  let totalDistance = 0;

  for (let i = 0; i < foundPath.length - 1; i++) {
    const fromNode = foundPath[i].id;
    const toNode = foundPath[i + 1].id;
    
    // Find the link between these nodes
    const link = ngraphInstance.getLink(fromNode, toNode);
    if (link) {
      edges.push(link.data.eid);
      edgeShadeValues.push(link.data.shade ?? 0);
      totalDistance += distance(
        [graph.coords[fromNode][1], graph.coords[fromNode][0]],
        [graph.coords[toNode][1], graph.coords[toNode][0]],
        { units: 'meters' });
    }
  }

  return {
    path: pathNodes,
    edges,
    shade: edgeShadeValues,
    distance: totalDistance,
    time_s: totalDistance / walkSpeed,
  };
}

// Find nearest node to given coordinates that has connections
function nearestNode(graph, lat, lon) {
  let bestIdx = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < graph.coords.length; i++) {
    if (!graph.coords[i]) continue;
    
    // Check if node has connections in the ngraph
    const node = graph.ngraph.getNode(i);
    if (!node) continue;
    
    // Check if node has any links (connections)
    let hasConnections = false;
    graph.ngraph.forEachLinkedNode(i, () => {
      hasConnections = true;
      return true; // break early
    });
    
    if (!hasConnections) continue;
    
    const [nodeLat, nodeLon] = graph.coords[i];
    const dist = distance([lon, lat], [nodeLon, nodeLat], { units: 'meters' });

    if (dist < bestDistance) {
      bestDistance = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

// Main route finding function
export function findRoute(graph, start, goal, options = {}) {
  const startTime = performance.now();
  console.log(`Finding route from (${start.latitude}, ${start.longitude}) to (${goal.latitude}, ${goal.longitude})`);

  const startIdx = nearestNode(graph, start.latitude, start.longitude);
  const goalIdx = nearestNode(graph, goal.latitude, goal.longitude);

  console.log(`Nearest nodes:`);
  console.log(graph.ngraph.getNode(startIdx))
  console.log(graph.ngraph.getNode(goalIdx));

  if (startIdx === -1 || goalIdx === -1) {
    throw new Error("Could not find nearby nodes for start or goal coordinates");
  }

  const result = astar(graph, startIdx, goalIdx, options);

  if (result.path.length === 0) {
    console.warn("No route found between the specified points");
    throw new Error("No route found between the specified points");
  }

  // Convert path indices to coordinates (GeoJSON format: [lon, lat])
  const coordinates = result.path.map(idx => {
    const [lat, lon] = graph.coords[idx];
    return [lon, lat]; // GeoJSON expects [longitude, latitude]
  });

  const endTime = performance.now() - startTime;
  console.log(`Route found: ${result.path.length} nodes, ${result.distance.toFixed(0)}m, ${result.time_s.toFixed(1)}s`);
  console.log(`Route computation time: ${endTime.toFixed(1)} ms`);
  return {
    coordinates,
    distance: result.distance,
    duration: result.time_s,
    path: result.path,
    edges: result.edges,
    shade: result.shade,
  };
}