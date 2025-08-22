import distance from '@turf/distance';
import { point } from '@turf/helpers';

const calculateDistance = (coord1, coord2) => {
  const from = point(coord1);
  const to = point(coord2);
  return distance(from, to, {units: 'meters'});
};

const interpolateCoordinates = (coord1, coord2, ratio) => {
  return [
    coord1[0] + (coord2[0] - coord1[0]) * ratio,
    coord1[1] + (coord2[1] - coord1[1]) * ratio
  ];
};

const getBoundingBox = (coords) => {
  let minX = coords[0][0], maxX = coords[0][0];
  let minY = coords[0][1], maxY = coords[0][1];
  
  for (let i = 1; i < coords.length; i++) {
    const [x, y] = coords[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  
  return { minX, maxX, minY, maxY };
};

const segmentIntersectsBoundingBox = (start, end, boundingBox) => {
  const [x1, y1] = start;
  const [x2, y2] = end;
  
  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);
  
  return !(segMaxX < boundingBox.minX || segMinX > boundingBox.maxX || 
           segMaxY < boundingBox.minY || segMinY > boundingBox.maxY);
};

const pointInPolygon = (point, coords) => {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i];
    const [xj, yj] = coords[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

const lineSegmentIntersectsPolygon = (start, end, polygon, boundingBox) => {
  if (!segmentIntersectsBoundingBox(start, end, boundingBox)) {
    return false;
  }
  
  const coords = polygon.geometry.coordinates[0];
  
  if (pointInPolygon(start, coords) || pointInPolygon(end, coords)) {
    return true;
  }
  
  const [x1, y1] = start;
  const [x2, y2] = end;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const [x3, y3] = coords[i];
    const [x4, y4] = coords[i + 1];
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) continue;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return true;
    }
  }
  
  return false;
};

export const getShadyPathSections = (pathCoordinates, shadowPolygons) => {
  if (!pathCoordinates || !shadowPolygons || pathCoordinates.length < 2) {
    return [];
  }
  
  const polygonsWithBoundingBox = shadowPolygons.map(polygon => ({
    polygon,
    boundingBox: getBoundingBox(polygon.geometry.coordinates[0])
  }));
  
  const shadySections = [];
  
  for (let i = 0; i < pathCoordinates.length - 1; i++) {
    const start = pathCoordinates[i];
    const end = pathCoordinates[i + 1];
    
    let isInShadow = false;
    for (let j = 0; j < polygonsWithBoundingBox.length; j++) {
      const { polygon, boundingBox } = polygonsWithBoundingBox[j];
      if (lineSegmentIntersectsPolygon(start, end, polygon, boundingBox)) {
        isInShadow = true;
        break;
      }
    }
    
    shadySections.push({
      segmentIndex: i,
      start: start,
      end: end,
      isInShadow: isInShadow
    });
  }
  
  return shadySections;
};

export const calculateShadePercentages = (shadyPathSections) => {
  if (!shadyPathSections || shadyPathSections.length === 0) {
    return { shadePercentage: 0, sunPercentage: 0 };
  }

  let totalDistance = 0;
  let shadyDistance = 0;

  shadyPathSections.forEach(section => {
    const segmentDistance = calculateDistance(section.start, section.end);
    totalDistance += segmentDistance;
    
    if (section.isInShadow) {
      shadyDistance += segmentDistance;
    }
  });

  const shadePercentage = totalDistance > 0 ? (shadyDistance / totalDistance) * 100 : 0;
  const sunPercentage = 100 - shadePercentage;

  return {
    shadePercentage: Math.round(shadePercentage * 10) / 10,
    sunPercentage: Math.round(sunPercentage * 10) / 10,
    totalDistance: Math.round(totalDistance),
    shadyDistance: Math.round(shadyDistance),
    sunnyDistance: Math.round(totalDistance - shadyDistance)
  };
};

export const createGroupedPaths = (shadyPathSections) => {
  if (!shadyPathSections || shadyPathSections.length === 0) {
    return { sunnyPaths: [], shadyPaths: [] };
  }

  const sunnyPaths = [];
  const shadyPaths = [];
  
  let currentPath = null;
  let currentIsShady = null;

  shadyPathSections.forEach((section, index) => {
    if (currentIsShady === null || currentIsShady !== section.isInShadow) {
      // Save previous path if it exists
      if (currentPath) {
        if (currentIsShady) {
          shadyPaths.push({ coordinates: currentPath });
        } else {
          sunnyPaths.push({ coordinates: currentPath });
        }
      }
      
      // Start new path
      currentPath = [section.start, section.end];
      currentIsShady = section.isInShadow;
    } else {
      // Continue current path
      currentPath.push(section.end);
    }
  });

  // Add the final path
  if (currentPath) {
    if (currentIsShady) {
      shadyPaths.push({ coordinates: currentPath });
    } else {
      sunnyPaths.push({ coordinates: currentPath });
    }
  }

  return { sunnyPaths, shadyPaths };
};

export const chunkRoute = (route, maxSegmentLength = 50) => {
  if (!route || !route.coordinates) return route;
  
  const chunkedCoordinates = [];
  const coordinates = route.coordinates;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const distance = calculateDistance(start, end);
    
    chunkedCoordinates.push(start);
    
    if (distance > maxSegmentLength) {
      const numChunks = Math.ceil(distance / maxSegmentLength);
      for (let j = 1; j < numChunks; j++) {
        const ratio = j / numChunks;
        const interpolated = interpolateCoordinates(start, end, ratio);
        chunkedCoordinates.push(interpolated);
      }
    }
  }
  
  chunkedCoordinates.push(coordinates[coordinates.length - 1]);
  
  return {
    ...route,
    coordinates: chunkedCoordinates
  };
  };