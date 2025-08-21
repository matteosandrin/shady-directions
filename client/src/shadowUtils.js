import SunCalc from 'suncalc';

export const calculateSolarPosition = (date, latitude, longitude) => {
  const sunPosition = SunCalc.getPosition(date, latitude, longitude);
  return {
    elevation: sunPosition.altitude,
    azimuth: sunPosition.azimuth
  };
};

export const calculateShadowFootprints = (building, solarPosition, groundLevel = 0) => {
  if (solarPosition.elevation <= 0) {
    return null;
  }

  const { elevation, azimuth } = solarPosition;
  const shadowLength = building.height / Math.tan(elevation);
  
  const shadowOffset = {
    x: shadowLength * Math.sin(azimuth),
    y: shadowLength * Math.cos(azimuth)
  };

  if (building.geometry?.type !== 'Polygon') {
    return null;
  }

  const buildingCoordinates = building.geometry.coordinates[0];
  
  // Convert meters to degrees more accurately for Manhattan's latitude
  const latitude = buildingCoordinates[0][1]; // Use building's latitude
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(latitude * Math.PI / 180);
  
  const shadowCoordinates = buildingCoordinates.map(coord => [
    coord[0] + shadowOffset.x / metersPerDegreeLng,
    coord[1] + shadowOffset.y / metersPerDegreeLat
  ]);

  let parallelogramCoordinates = [];
  for (let i = 0; i < buildingCoordinates.length - 1; i++) {
    parallelogramCoordinates.push([
      buildingCoordinates[i],
      buildingCoordinates[i + 1],
      shadowCoordinates[i + 1],
      shadowCoordinates[i]
    ]);
  }

  const allCoordinates = [
    ...parallelogramCoordinates,
    shadowCoordinates
  ];

  return allCoordinates.map(coords => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    },
    properties: {
      buildingId: building.properties?.['@id'] || 'unknown',
      shadowLength,
      buildingHeight: building.height
    }
  }));
};

export const generateShadowLayer = (buildings, solarPosition) => {
  if (!buildings || !solarPosition || solarPosition.elevation <= 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  const shadowFeatures = buildings
    .map(building => {
      const height = building.properties?.height || 
                    building.properties?.HEIGHT || 
                    building.properties?.elevation || 
                    building.properties?.ELEVATION || 20;
      
      return calculateShadowFootprints({
        ...building,
        height: parseFloat(height)
      }, solarPosition);
    })
    .flat()
    .filter(shadow => shadow !== null);

  return {
    type: 'FeatureCollection',
    features: shadowFeatures
  };
};

export const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const parseDateTime = (dateTimeString) => {
  return new Date(dateTimeString);
};