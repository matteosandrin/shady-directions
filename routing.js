import fs from "node:fs";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = d => d * Math.PI / 180;
  const dlat = toRad(lat2 - lat1);
  const dlon = toRad(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function buildGraph() {
  console.log("Building routing graph from Overpass data...");

  // Read and parse the Overpass JSON data
  const overpass = JSON.parse(fs.readFileSync("data/manhattan_ways.json", "utf8"));
  const elements = overpass.elements;

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
      // console.error(`Node index ${nodeData.idx} exceeds array length ${graph.coords.length} for node ${osmId}`);
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
      const length = haversine(nodeA.lat, nodeA.lon, nodeB.lat, nodeB.lon);

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

  // Phase 5: Initialize shade data (placeholder)
  const shadeByEdgeId = new Map();
  for (const { eid } of edgesMeta) {
    shadeByEdgeId.set(eid, 0.0); // Default: fully sunny (0 = no shade, 1 = full shade)
  }

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
  } = opts;

  const N = graph.adj.length;
  const g = new Float64Array(N).fill(Infinity);
  const f = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const parentEdge = new Int32Array(N).fill(-1);

  const [goalLat, goalLon] = graph.coords[goalIdx];

  function heuristic(i) {
    const [lat, lon] = graph.coords[i];
    const distance = haversine(lat, lon, goalLat, goalLon);
    return distance / walkSpeed; // optimistic time estimate
  }

  // Simple binary heap for priority queue
  const heap = [];
  function push(i) {
    heap.push(i);
    siftUp(heap.length - 1);
  }

  function pop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      siftDown(0);
    }
    return top;
  }

  function siftUp(k) {
    while (k > 0) {
      const parent = Math.floor((k - 1) / 2);
      if (f[heap[parent]] <= f[heap[k]]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  }

  function siftDown(k) {
    while (true) {
      let left = k * 2 + 1;
      let right = left + 1;
      let smallest = k;

      if (left < heap.length && f[heap[left]] < f[heap[smallest]]) {
        smallest = left;
      }
      if (right < heap.length && f[heap[right]] < f[heap[smallest]]) {
        smallest = right;
      }
      if (smallest === k) break;

      [heap[smallest], heap[k]] = [heap[k], heap[smallest]];
      k = smallest;
    }
  }

  g[startIdx] = 0;
  f[startIdx] = heuristic(startIdx);
  push(startIdx);

  const closed = new Uint8Array(N);

  while (heap.length > 0) {
    const current = pop();

    if (current === goalIdx) break;
    if (closed[current]) continue;

    closed[current] = 1;

    for (const edge of graph.adj[current]) {
      const neighbor = edge.to;

      // Calculate edge cost with shade preference
      const shade = graph.shadeByEdgeId?.get(edge.eid) ?? 0;
      const sunExposure = 1 - shade;

      // Higher shade preference means we prefer shaded paths
      const shadeBonus = shadePreference * shade;
      const sunPenalty = shadePreference * sunExposure;

      const baseTime = edge.length / walkSpeed;
      const edgeTime = baseTime * (1 + sunPenalty - shadeBonus);

      const tentativeG = g[current] + edgeTime;

      if (tentativeG < g[neighbor]) {
        g[neighbor] = tentativeG;
        parent[neighbor] = current;
        parentEdge[neighbor] = edge.eid;
        f[neighbor] = tentativeG + heuristic(neighbor);
        push(neighbor);
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

  return {
    path,
    time_s: g[goalIdx],
    edges,
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
    const distance = haversine(lat, lon, nodeLat, nodeLon);

    if (distance < bestDistance) {
      bestDistance = distance;
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
    edges: result.edges
  };
}