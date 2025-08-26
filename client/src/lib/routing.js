import { Heap } from 'heap-js';
import { distance } from '@turf/distance';
import { calculateShadeMap } from './shadowShader';
import { ShadeMapSampler } from './shadowShaderUtils';

async function getWaysData() {
  const response = await fetch('/data/manhattan_ways.json');
  if (!response.ok) {
    throw new Error('Failed to fetch manhattan ways data');
  }
  return await response.json();
}

async function getShadeData(start, end, date) {
  if (!start || !end) return;

  try {
    const padding = 0.005; // roughly 500 meters
    const bounds = {
      west: Math.min(start.lng, end.lng) - padding,
      east: Math.max(start.lng, end.lng) + padding,
      north: Math.max(start.lat, end.lat) + padding,
      south: Math.min(start.lat, end.lat) - padding
    };
    const shadeMapResult = await calculateShadeMap(bounds, date);
    console.log('Shade map generated:', shadeMapResult);
    return shadeMapResult;
  } catch (error) {
    console.error('Error generating shade map:', error);
  }
};

export async function findWalkingRoute(start, end, date, options = {}) {
  const waysData = await getWaysData();
  const shadeData = await getShadeData(start, end, date);
  const graph = buildGraph(waysData, shadeData);
  const route = findRoute(graph, {
    latitude: start.lat,
    longitude: start.lng
  }, {
    latitude: end.lat,
    longitude: end.lng
  }, options);
  return route;
};

export function buildGraph(waysData, shadeData = null) {
  console.log("Building routing graph from Overpass data...");

  const elements = waysData.elements;
  console.log(`Loaded ${elements.length} elements from Overpass data`);

  // Phase 1: Collect all nodes
  const nodes = new Map(); // osmNodeId -> {lat, lon, idx}
  let idxCounter = 0;

  for (const el of elements) {
    if (el.type === "node") {
      nodes.set(el.id, {
        lat: el.lat,
        lon: el.lon,
        idx: idxCounter++,
        osmId: el.id
      });
    }
  }

  console.log(`Found ${nodes.size} nodes`);

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

  // Phase 3: Initialize graph structure
  const graph = {
    coords: new Array(nodes.size),     // idx -> [lat, lon]
    adj: Array.from({ length: nodes.size }, () => []), // adjacency list
    nodeOsmIds: new Array(nodes.size), // idx -> osmId for debugging
  };

  // Fill coordinate array and validate indices
  for (const [osmId, nodeData] of nodes) {
    if (nodeData.idx >= graph.coords.length) {
      continue;
    }
    graph.coords[nodeData.idx] = [nodeData.lat, nodeData.lon];
    graph.nodeOsmIds[nodeData.idx] = osmId;
  }

  console.log(`Graph initialized with ${graph.coords.length} coordinate slots and ${graph.adj.length} adjacency lists`);

  // Phase 4: Build edges from walkable ways
  let edgeSeq = 0;
  const edgesMeta = [];
  let waysProcessed = 0;
  let edgesCreated = 0;

  for (const el of elements) {
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

      if (nodeA.idx >= graph.adj.length || nodeB.idx >= graph.adj.length || nodeA.idx < 0 || nodeB.idx < 0) {
        continue;
      }

      // Check if adjacency arrays exist
      if (!graph.adj[nodeA.idx] || !graph.adj[nodeB.idx]) {
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

      // Add edges to adjacency list
      // Most streets are bidirectional for pedestrians unless explicitly one-way
      const isOneway = el.tags?.oneway === "yes" ||
        el.tags?.oneway === "true" ||
        el.tags?.oneway === "1";

      // Forward direction
      graph.adj[nodeA.idx].push({
        to: nodeB.idx,
        length,
        eid,
        wayOsmId: el.id,
        highway: el.tags?.highway
      });

      edgesCreated++;

      // Reverse direction (if not one-way)
      if (!isOneway) {
        graph.adj[nodeB.idx].push({
          to: nodeA.idx,
          length,
          eid,
          wayOsmId: el.id,
          highway: el.tags?.highway
        });
        edgesCreated++;
      }
    }
  }

  // Phase 5: Initialize shade data
  const shadeByEdgeId = new Map();
  const shadeMapSampler = new ShadeMapSampler(shadeData);
  if (shadeData) {
    for (const { eid, a, b } of edgesMeta) {
      const [latA, lonA] = graph.coords[a];
      const [latB, lonB] = graph.coords[b];

      // Sample multiple points along the edge for better accuracy
      const samples = 20;
      let shadeSum = 0;
      let validSamples = 0;

      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const lat = latA + t * (latB - latA);
        const lon = lonA + t * (lonB - lonA);
        const isShaded = shadeMapSampler.sampleAt(lat, lon);
        if (isShaded !== null) {
          shadeSum += isShaded ? 1 : 0;
          validSamples++;
        }
      }

      if (validSamples > 0) {
        const shadeFraction = shadeSum / validSamples; // 0 = no shade, 1 = full shade
        shadeByEdgeId.set(eid, shadeFraction);
      } else {
        shadeByEdgeId.set(eid, 0.0); // Default to no shade if no valid samples
      }
    }
  }
  shadeMapSampler.dispose();

  // Attach metadata to graph
  graph.shadeByEdgeId = shadeByEdgeId;
  graph.edgesMeta = edgesMeta;

  console.log(`Graph building complete:`);
  console.log(`  - Nodes: ${nodes.size}`);
  console.log(`  - Ways processed: ${waysProcessed}`);
  console.log(`  - Edges created: ${edgesCreated}`);
  console.log(`  - Unique edge segments: ${edgesMeta.length}`);

  // Phase 6: Validate graph connectivity (optional)
  const connectedComponents = findConnectedComponents(graph);
  console.log(`  - Connected components: ${connectedComponents.length}`);
  if (connectedComponents.length > 1) {
    const sizes = connectedComponents.map(comp => comp.length).sort((a, b) => b - a);
    console.log(`  - Largest component: ${sizes[0]} nodes`);
  }

  return graph;
}

// Helper function to find connected components for graph validation
function findConnectedComponents(graph) {
  const visited = new Array(graph.coords.length).fill(false);
  const components = [];

  for (let i = 0; i < graph.coords.length; i++) {
    if (!visited[i]) {
      const component = [];
      const stack = [i];

      while (stack.length > 0) {
        const node = stack.pop();
        if (visited[node]) continue;

        visited[node] = true;
        component.push(node);

        for (const edge of graph.adj[node]) {
          if (!visited[edge.to]) {
            stack.push(edge.to);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }
  }

  return components;
}

// A* pathfinding algorithm with shade-aware cost function
function astar(graph, startIdx, goalIdx, opts = {}) {
  const {
    walkSpeed = 1.4,   // m/s (~5.0 km/h)
    shadePreference = 0.0, // 0 = no preference, 1 = strong shade preference
    pedestrianPathPreference = 0.2 // 0 = no preference, 1 = strong pedestrian path preference
  } = opts;

  const N = graph.adj.length;
  const g = new Float64Array(N).fill(Infinity);
  const f = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const parentEdge = new Int32Array(N).fill(-1);

  const [goalLat, goalLon] = graph.coords[goalIdx];

  function heuristic(i) {
    const [lat, lon] = graph.coords[i];
    const dist = distance([lon, lat], [goalLon, goalLat], { units: 'meters' });
    return dist / walkSpeed; // optimistic time estimate
  }

  // Priority queue using heap-js
  const heap = new Heap((a, b) => f[a] - f[b]);

  g[startIdx] = 0;
  f[startIdx] = heuristic(startIdx);
  heap.push(startIdx);

  const closed = new Uint8Array(N);

  while (heap.size() > 0) {
    const current = heap.pop();

    if (current === goalIdx) break;
    if (closed[current]) continue;

    closed[current] = 1;

    for (const edge of graph.adj[current]) {
      const neighbor = edge.to;
      const shade = graph.shadeByEdgeId?.get(edge.eid) ?? 0; // 0 = no shade, 1 = full shade

      // Pedestrian-only path preference (lower cost multiplier = higher preference)
      const isPedestrianOnly = ['footway', 'path', 'pedestrian', 'steps'].includes(edge.highway);
      const pathTypeMultiplier = isPedestrianOnly ? (1 - pedestrianPathPreference) : 1.0;

      const baseTime = edge.length / walkSpeed;
      const shadeMultiplier = 1 + shadePreference * (1 - shade);
      const edgeTime = baseTime * pathTypeMultiplier * shadeMultiplier;

      const tentativeG = g[current] + edgeTime;

      if (tentativeG < g[neighbor]) {
        g[neighbor] = tentativeG;
        parent[neighbor] = current;
        parentEdge[neighbor] = edge.eid;
        f[neighbor] = tentativeG + heuristic(neighbor);
        heap.push(neighbor);
      }
    }
  }

  if (!isFinite(g[goalIdx])) {
    return { path: [], time_s: Infinity, edges: [], distance: 0 };
  }

  // Reconstruct path
  const path = [];
  const edges = [];
  let totalDistance = 0;

  for (let current = goalIdx; current !== -1; current = parent[current]) {
    path.push(current);
    if (parentEdge[current] !== -1) {
      edges.push(parentEdge[current]);
      // Find edge length for distance calculation
      const edgeData = graph.edgesMeta.find(e => e.eid === parentEdge[current]);
      if (edgeData) {
        totalDistance += edgeData.length;
      }
    }
  }

  path.reverse();
  edges.reverse();

  const edgeShadeValues = edges.map(eid => graph.shadeByEdgeId?.get(eid) ?? 0);

  return {
    path,
    time_s: g[goalIdx],
    edges,
    shade: edgeShadeValues,
    distance: totalDistance
  };
}

// Find nearest node to given coordinates
function nearestNode(graph, lat, lon) {
  let bestIdx = -1;
  let bestDistance = Infinity;

  for (let i = 0; i < graph.coords.length; i++) {
    if (!graph.coords[i]) continue;
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
  console.log(`Finding route from (${start.latitude}, ${start.longitude}) to (${goal.latitude}, ${goal.longitude})`);

  const startIdx = nearestNode(graph, start.latitude, start.longitude);
  const goalIdx = nearestNode(graph, goal.latitude, goal.longitude);

  if (startIdx === -1 || goalIdx === -1) {
    throw new Error("Could not find nearby nodes for start or goal coordinates");
  }

  console.log(`Routing from node ${startIdx} to node ${goalIdx}`);

  const result = astar(graph, startIdx, goalIdx, options);

  if (result.path.length === 0) {
    throw new Error("No route found between the specified points");
  }

  // Convert path indices to coordinates (GeoJSON format: [lon, lat])
  const coordinates = result.path.map(idx => {
    const [lat, lon] = graph.coords[idx];
    return [lon, lat]; // GeoJSON expects [longitude, latitude]
  });

  console.log(`Route found: ${result.path.length} nodes, ${result.distance.toFixed(0)}m, ${result.time_s.toFixed(1)}s`);

  return {
    coordinates,
    distance: result.distance,
    duration: result.time_s,
    path: result.path,
    edges: result.edges,
    shade: result.shade,
  };
}