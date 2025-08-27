import { distance } from '@turf/turf';

/**
 * Draw shaded and sunny route segments on the map
 * @param {Array} shadedSegments - Array of shaded route segments
 * @param {Array} sunnySegments - Array of sunny route segments
 * @param {Object} map - Mapbox map instance
 */
function drawRouteSegments(shadedSegments, sunnySegments, map) {
  if (!map) return;

  // Remove existing shade route layers and sources
  const shadedRouteLayerId = 'shaded-route-line';
  const sunnyRouteLayerId = 'sunny-route-line';
  const shadedRouteSourceId = 'shaded-route';
  const sunnyRouteSourceId = 'sunny-route';

  [shadedRouteLayerId, sunnyRouteLayerId].forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });
  [shadedRouteSourceId, sunnyRouteSourceId].forEach(sourceId => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });

  // Add shaded route segments
  if (shadedSegments.length > 0) {
    const shadedFeatures = shadedSegments.map(segment => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates
      }
    }));

    map.addSource(shadedRouteSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: shadedFeatures
      }
    });

    map.addLayer({
      id: shadedRouteLayerId,
      type: 'line',
      source: shadedRouteSourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#8b5cf6', // Purple for shaded
        'line-width': 7,
        'line-opacity': 0.9
      }
    }, '3d-buildings');
  }

  // Add sunny route segments
  if (sunnySegments.length > 0) {
    const sunnyFeatures = sunnySegments.map(segment => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates
      }
    }));

    map.addSource(sunnyRouteSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: sunnyFeatures
      }
    });

    map.addLayer({
      id: sunnyRouteLayerId,
      type: 'line',
      source: sunnyRouteSourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#fbbf24', // Yellow for sunny
        'line-width': 7,
        'line-opacity': 0.9
      }
    }, '3d-buildings');
  }

  console.log(`Route segments drawn: ${shadedSegments.length} shaded, ${sunnySegments.length} sunny`);
}

/**
 * Analyze a route for shade coverage and add colored segments to the map
 * @param {Object} route - Route data with coordinates
 * @param {Object} shadowLayer - Shadow layer instance
 * @param {Object} map - Mapbox map instance
 */
export function updateRouteShade(route, shadowLayer, map) {
  const { shadedSegments, sunnySegments, stats } = computeSegmentsAndStats(route);
  drawRouteSegments(shadedSegments, sunnySegments, map);
  console.log(`Route analysis complete: ${stats.shadedPercentage}% shaded (${stats.shadedDistance}m), ${stats.sunnyPercentage}% sunny (${stats.sunnyDistance}m), total: ${stats.totalDistance}m`);
  return stats;
}

function computeSegmentsAndStats(route) {
  const shadedSegments = [];
  const sunnySegments = [];
  let totalDistance = 0;
  let totalShadedDistance = 0;
  route.coordinates.map((e, i) => {
    if (i > 0) {
      const start = route.coordinates[i - 1];
      const end = route.coordinates[i];
      const shade = route.shade[i - 1];
      const dist = distance([start[0], start[1]], [end[0], end[1]], { units: 'meters' });
      if (shade > 0) {
        shadedSegments.push({ coordinates: [start, end] });
        totalShadedDistance += dist;
      } else {
        sunnySegments.push({ coordinates: [start, end] });
      }
      totalDistance += dist;
    }
    return null;
  });
  const totalSunnyDistance = totalDistance - totalShadedDistance;
  const shadedPercentage = totalDistance > 0 ? Math.round((totalShadedDistance / totalDistance) * 100) : 0;
  const sunnyPercentage = totalDistance > 0 ? Math.round((totalSunnyDistance / totalDistance) * 100) : 0;
  return {
    shadedSegments,
    sunnySegments,
    stats: {
      shadedPercentage,
      sunnyPercentage,
      totalDistance: Math.round(totalDistance),
      shadedDistance: Math.round(totalShadedDistance),
      sunnyDistance: Math.round(totalSunnyDistance)
    }
  }
}