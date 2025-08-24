/**
 * Shadow Shader Utilities
 * Functions to query BuildingShadows shader output and determine shadow coverage
 */

/**
 * Check if a specific geographic point is in shadow
 * @param {number} lng - Longitude of the point
 * @param {number} lat - Latitude of the point
 * @param {BuildingShadows} shadowLayer - The shadow layer instance
 * @param {Object} map - Mapbox map instance
 * @returns {Object} Shadow information for the point
 */
export function isPointInShadow(lng, lat, shadowLayer, map) {
  if (!shadowLayer || !map || !shadowLayer.fb || !shadowLayer.tex) {
    return {
      isShaded: false,
      confidence: 0,
      error: 'Shadow layer not available'
    };
  }

  try {
    const gl = map.painter.context.gl;
    const { x, y } = map.project([lng, lat]);
    const canvas = map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;
    const dpr = canvas.width / canvas.clientWidth;

    const pixelX = Math.floor(x * dpr);
    const pixelY = Math.floor(height - y * dpr); // flip Y in device px

    // Check if coordinates are within canvas bounds
    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
      return {
        isShaded: false,
        error: 'Point is outside visible area',
        screenCoord: { x: pixelX, y: pixelY }
      };
    }

    // Read pixel data from shadow framebuffer
    const pixelData = readPixelFromShadowTexture(gl, shadowLayer, pixelX, pixelY);
    
    if (!pixelData) {
      return {
        isShaded: false,
        error: 'Failed to read shadow data'
      };
    }

    // Analyze pixel data to determine shadow status
    const shadowInfo = analyzeShadowPixel(pixelData);
    const geoPoint = map.unproject([pixelX, pixelY]);

    return {
      isShaded: shadowInfo.isShaded,
      pixelData,
      screenCoord: { x: pixelX, y: pixelY },
      geoCoord: { lng: geoPoint.lng, lat: geoPoint.lat }
    };

  } catch (error) {
    console.error('Error checking point shadow status:', error);
    return {
      isShaded: false,
      error: error.message
    };
  }
}

/**
 * Read a single pixel from the shadow texture
 * @private
 */
function readPixelFromShadowTexture(gl, shadowLayer, x, y) {
  try {
    // Bind shadow framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowLayer.fb);
    
    // Read single pixel
    const pixelData = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    
    // Restore default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      r: pixelData[0],
      g: pixelData[1],
      b: pixelData[2],
      a: pixelData[3]
    };

  } catch (error) {
    console.error('Error reading shadow pixel:', error);
    return null;
  }
}

/**
 * Analyze pixel data to determine shadow status
 * @private
 */
function analyzeShadowPixel(pixelData) {
  // Shadow pixels should have high alpha values (rendered geometry)
  // Non-shadow areas should be transparent (alpha = 0)
  const alpha = pixelData.a;
  const isShaded = alpha > 128; // 50% alpha threshold
  
  // Calculate confidence based on alpha value
  // Higher alpha = higher confidence in shadow detection
  const confidence = alpha / 255;

  return {
    isShaded,
    confidence
  };
}

/**
 * Debug function that tests shadow detection in a 100x100 area around a click point
 * and visualizes the results with yellow pixels on the map
 * @param {number} clickLng - Longitude of click point
 * @param {number} clickLat - Latitude of click point
 * @param {BuildingShadows} shadowLayer - The shadow layer instance
 * @param {Object} map - Mapbox map instance
 * @returns {void}
 */
export function debugShadowDetectionArea(clickLng, clickLat, shadowLayer, map) {
  if (!shadowLayer || !map) {
    console.log('Shadow layer or map not available for debugging');
    return;
  }

  // Remove existing debug layer
  const debugLayerId = 'shadow-debug-pixels';
  const debugSourceId = 'shadow-debug-source';
  
  if (map.getLayer(debugLayerId)) {
    map.removeLayer(debugLayerId);
  }
  if (map.getSource(debugSourceId)) {
    map.removeSource(debugSourceId);
  }

  const { x, y } = map.project([clickLng, clickLat]);

  const centerX = Math.floor(x);
  const centerY = Math.floor(y);

  console.log('Click screen coordinates:', { centerX, centerY });

  // Create array to store debug points
  const debugPoints = [];
  let totalPoints = 0;

  // Test 100x100 area around click point
  const gridSize = 100;
  const halfGrid = Math.floor(gridSize / 2);

  for (let dx = -halfGrid; dx <= halfGrid; dx += 1) {
    for (let dy = -halfGrid; dy <= halfGrid; dy += 1) {
      const screenX = centerX + dx;
      const screenY = centerY + dy;
      const testCoords = map.unproject([screenX, screenY]);

      // Convert screen coordinates back to geographic coordinates
      try {
        // Test shadow detection at this point
        const shadowResult = isPointInShadow(testCoords.lng, testCoords.lat, shadowLayer, map);
        
        totalPoints++;
        debugPoints.push({
          type: 'Feature',
          properties: {
            isShaded: shadowResult.isShaded,
          },
          geometry: {
            type: 'Point',
            coordinates: [testCoords.lng, testCoords.lat]
          }
        });
      } catch (error) {
        console.warn('Failed to test point at screen coords:', { x, y }, error);
      }
    }
  }

  // Add debug visualization to map
  if (debugPoints.length > 0) {
    map.addSource(debugSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: debugPoints
      }
    });

    map.addLayer({
      id: debugLayerId,
      type: 'circle',
      source: debugSourceId,
      paint: {
        'circle-color': [
          'case',
          ['get', 'isShaded'],
          '#8b5cf6', // Purple for shaded areas (isShaded: true)
          '#ffff00'  // Yellow for sunny areas (isShaded: false)
        ],
        'circle-radius': 1,
        'circle-opacity': 0.8,
        'circle-stroke-width': 0,
      }
    });

    console.log(`🔍 Added ${debugPoints.length} debug pixels to map (purple = shaded, yellow = sunny)`);
  } else {
    console.log('🔍 No shadow pixels detected in the test area');
  }

  // Also log some sample pixel data for analysis
  if (debugPoints.length > 0) {
    const samples = debugPoints.slice(0, 5); // First 5 points
    console.log('🔍 Sample shadow pixels:', samples.map(p => ({
      coordinates: p.geometry.coordinates,
      pixelData: p.properties.pixelData,
      confidence: p.properties.confidence
    })));
  }
}

/**
 * Get debug information about the shadow layer
 * @param {BuildingShadows} shadowLayer - The shadow layer instance
 * @param {Object} map - Mapbox map instance
 * @returns {Object} Debug information
 */
export function getShadowLayerDebugInfo(shadowLayer, map) {
  if (!shadowLayer || !map) {
    return { error: 'Shadow layer or map not available' };
  }

  const canvas = map.getCanvas();
  const center = map.getCenter();
  
  return {
    layerId: shadowLayer.id,
    layerType: shadowLayer.type,
    currentDate: shadowLayer.date,
    lastAltitude: shadowLayer.lastAltitude,
    lastAzimuth: shadowLayer.lastAzimuth,
    canvasDimensions: {
      width: canvas.width,
      height: canvas.height
    },
    mapCenter: {
      lng: center.lng,
      lat: center.lat
    },
    mapZoom: map.getZoom(),
    hasFramebuffer: !!shadowLayer.fb,
    hasTexture: !!shadowLayer.tex,
    sunPosition: {
      altitude: shadowLayer.lastAltitude ? shadowLayer.lastAltitude * 180 / Math.PI : null,
      azimuth: shadowLayer.lastAzimuth ? shadowLayer.lastAzimuth * 180 / Math.PI : null
    }
  };
}