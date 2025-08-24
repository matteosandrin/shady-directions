import { isPointInShadow } from './shadowShaderUtils';

/**
 * Analyze route coordinates to determine shaded and sunny segments
 * @param {Object} route - Route data with coordinates
 * @param {Object} shadowLayer - Shadow layer instance
 * @param {Object} map - Mapbox map instance
 * @returns {Object} Object containing shadedSegments and sunnySegments arrays
 */
function analyzeRouteForShade(route, shadowLayer, map) {
  if (!route || !shadowLayer || !map) return { shadedSegments: [], sunnySegments: [] };

  const coordinates = route.coordinates;
  const segments = [];
  const sampleInterval = 10; // Sample every 10 meters along route

  // Sample points along the route
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    
    // Calculate distance between points (rough approximation)
    const deltaLng = end[0] - start[0];
    const deltaLat = end[1] - start[1];
    const distance = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat) * 111320; // rough meters
    
    const numSamples = Math.max(2, Math.ceil(distance / sampleInterval));
    
    for (let j = 0; j < numSamples - 1; j++) {
      const t1 = j / (numSamples - 1);
      const t2 = (j + 1) / (numSamples - 1);
      
      const point1 = [
        start[0] + deltaLng * t1,
        start[1] + deltaLat * t1
      ];
      const point2 = [
        start[0] + deltaLng * t2,
        start[1] + deltaLat * t2
      ];
      
      // Check if midpoint is in shadow
      const midLng = (point1[0] + point2[0]) / 2;
      const midLat = (point1[1] + point2[1]) / 2;
      
      const shadowResult = isPointInShadow(midLng, midLat, shadowLayer, map);
      
      segments.push({
        coordinates: [point1, point2],
        isShaded: shadowResult.isShaded
      });
    }
  }

  // Group consecutive segments of same type
  const shadedSegments = [];
  const sunnySegments = [];
  
  let currentShadedSegment = null;
  let currentSunnySegment = null;
  
  // Calculate distances and group segments
  let totalShadedDistance = 0;
  let totalSunnyDistance = 0;

  segments.forEach(segment => {
    // Calculate segment distance
    const [point1, point2] = segment.coordinates;
    const deltaLng = point2[0] - point1[0];
    const deltaLat = point2[1] - point1[1];
    const segmentDistance = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat) * 111320; // rough meters
    
    if (segment.isShaded) {
      totalShadedDistance += segmentDistance;
      // Add to shaded segments
      if (currentShadedSegment) {
        currentShadedSegment.coordinates.push(segment.coordinates[1]);
        currentShadedSegment.distance += segmentDistance;
      } else {
        currentShadedSegment = {
          coordinates: [segment.coordinates[0], segment.coordinates[1]],
          distance: segmentDistance
        };
      }
      // End sunny segment if exists
      if (currentSunnySegment) {
        sunnySegments.push(currentSunnySegment);
        currentSunnySegment = null;
      }
    } else {
      totalSunnyDistance += segmentDistance;
      // Add to sunny segments
      if (currentSunnySegment) {
        currentSunnySegment.coordinates.push(segment.coordinates[1]);
        currentSunnySegment.distance += segmentDistance;
      } else {
        currentSunnySegment = {
          coordinates: [segment.coordinates[0], segment.coordinates[1]],
          distance: segmentDistance
        };
      }
      // End shaded segment if exists
      if (currentShadedSegment) {
        shadedSegments.push(currentShadedSegment);
        currentShadedSegment = null;
      }
    }
  });
  
  // Add remaining segments
  if (currentShadedSegment) shadedSegments.push(currentShadedSegment);
  if (currentSunnySegment) sunnySegments.push(currentSunnySegment);

  // Calculate percentages based on distance
  const totalDistance = totalShadedDistance + totalSunnyDistance;
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
  };
}

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
  const { shadedSegments, sunnySegments, stats } = analyzeRouteForShade(route, shadowLayer, map);
  drawRouteSegments(shadedSegments, sunnySegments, map);
  console.log(`Route analysis complete: ${stats.shadedPercentage}% shaded (${stats.shadedDistance}m), ${stats.sunnyPercentage}% sunny (${stats.sunnyDistance}m), total: ${stats.totalDistance}m`);
  return stats;
}