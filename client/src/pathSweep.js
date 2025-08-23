import * as turf from '@turf/turf';
import polygonClipping from 'polygon-clipping'; // robust boolean ops

// P: Feature<Polygon> (simple polygon, no holes) in planar coords
// v: [dx, dy]
function translateRing(ring, [dx, dy]) {
  return ring.map(([x, y]) => [x + dx, y + dy]);
}

function translatePolygon(P, v) {
  return turf.polygon(
    P.geometry.coordinates.map(r => translateRing(r, v)),
    P.properties || {}
  );
}

function edgeSweepQuads(P, v) {
  const [outer, ...holes] = P.geometry.coordinates;
  const quads = [];

  // helper to push quads for a ring
  function sweepRing(ring) {
    for (let i = 0; i < ring.length - 1; i++) { // last=first in GeoJSON
      const a = ring[i], b = ring[i + 1];
      const av = [a[0] + v[0], a[1] + v[1]];
      const bv = [b[0] + v[0], b[1] + v[1]];
      // Quad order: a -> b -> bv -> av -> a
      quads.push(turf.polygon([[a, b, bv, av, a]]));
    }
  }

  sweepRing(outer);
  // If P has holes and you want the *sweep of holes subtracted*,
  // you'd treat them carefully (they generate quads too, but subtract them).
  // For simple "no holes" polygons, the above suffices.

  return quads;
}

function unionMany(polys) {
  // polygon-clipping expects arrays of rings (no Feature wrappers)
  const geometries = polys.map(f => f.geometry.coordinates);
  const result = polygonClipping.union(...geometries);
  if (!result) return null; // empty
  // polygon-clipping returns MultiPolygon-like nested arrays
  // Normalize to GeoJSON (Polygon or MultiPolygon)
  if (result.length === 1) {
    return turf.polygon(result[0]);
  } else {
    return turf.multiPolygon(result);
  }
}

export function sweepPolygon(P, v) {
  const P2 = translatePolygon(P, v);
  const quads = edgeSweepQuads(P, v);
  return unionMany([P, P2, ...quads]); // Feature<Polygon|MultiPolygon>
}