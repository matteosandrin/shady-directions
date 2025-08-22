import React, { useState, useEffect, useMemo } from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { calculateSolarPosition, generateShadowLayer, formatDateTime, parseDateTime } from './shadowUtils';
import { getShadyPathSections, calculateShadePercentages, createGroupedPaths, chunkRoute } from './pathIntersection';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import ControlPanel from './components/ControlPanel';

const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const detectMobile = () => {
  // Check for mobile user agents
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUserAgent = mobileRegex.test(navigator.userAgent);
  
  // Check for touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size (typical mobile breakpoint)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Consider it mobile if any of these conditions are true
  return isMobileUserAgent || (isTouchDevice && isSmallScreen);
};

const INITIAL_VIEW_STATE = {
  longitude: -74.006,
  latitude: 40.7128,
  zoom: 13,
  pitch: 0,
  bearing: 0
};

function App() {
  const [geojsonData, setGeojsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(formatDateTime(new Date()));
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessingRoute, setIsProcessingRoute] = useState(false);
  
  const manhattanCenter = { lat: 40.7128, lng: -74.006 };


  useEffect(() => {
    fetchGeojsonData();
    setIsSelectingStart(true);
  }, []);

  useEffect(() => {
    // Initial mobile detection
    setIsMobile(detectMobile());
    
    // Listen for window resize to re-detect mobile (for responsive design)
    const handleResize = () => {
      setIsMobile(detectMobile());
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup event listener
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const processGeojsonData = (data) => {
    const processedFeatures = data.features.map(feature => {
      if (feature.geometry.type === 'MultiPolygon') {
        return feature.geometry.coordinates.map((polygon, index) => ({
          ...feature,
          geometry: {
            type: 'Polygon',
            coordinates: polygon
          },
          properties: {
            ...feature.properties,
            _multipart: index
          }
        }));
      }
      return feature;
    }).flat().filter(feature => {
      const properties = feature.properties || {};
      const isUnderground = properties.location === 'underground';
      return !isUnderground;
    });


    return {
      ...data,
      features: processedFeatures
    };
  };

  const fetchGeojsonData = async () => {
    try {
      const response = await fetch('/data/manhattan.geojson');
      const result = await response.json();
      
      if (response.ok) {
        const processedData = processGeojsonData(result);
        setGeojsonData(processedData);
      } else {
        setError('Failed to load data');
      }
    } catch (err) {
      setError('Error connecting to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoute = async (start, end) => {
    setIsProcessingRoute(true);
    try {
      const response = await fetch('/directions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start, end }),
      });
      const result = await response.json();
      
      if (result.success) {
        // make the route more granular so we can show the shaded sections with
        // higher resolution
        const chunkedRoute = chunkRoute(result.route);
        setRouteData(chunkedRoute);
      } else {
        console.error('Route calculation failed:', result.error);
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    } finally {
      setIsProcessingRoute(false);
    }
  };

  const handleMapClick = (info) => {
    if (!info.coordinate) return;
    
    const [longitude, latitude] = info.coordinate;
    const point = { longitude, latitude };
    
    if (isSelectingStart) {
      setStartPoint(point);
      setIsSelectingStart(false);
      if (endPoint) {
        fetchRoute(point, endPoint);
      } else {
        setIsSelectingEnd(true);
      }
    } else if (isSelectingEnd) {
      setEndPoint(point);
      setIsSelectingEnd(false);
      if (startPoint) {
        fetchRoute(startPoint, point);
      }
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteData(null);
    setIsSelectingStart(false);
    setIsSelectingEnd(false);
    setIsProcessingRoute(false);
  };

  const solarPosition = useMemo(() => {
    const date = parseDateTime(selectedDateTime);
    return calculateSolarPosition(date, manhattanCenter.lat, manhattanCenter.lng);
  }, [selectedDateTime, manhattanCenter.lat, manhattanCenter.lng]);

  const shadowData = useMemo(() => {
    if (!geojsonData) return null;
    return generateShadowLayer(geojsonData.features, solarPosition);
  }, [geojsonData, solarPosition]);

  const shadyPathSections = useMemo(() => {
    if (!routeData || !shadowData) return null;
    
    const pathCoordinates = routeData.coordinates;
    const shadowPolygons = shadowData.features;
    
    return getShadyPathSections(pathCoordinates, shadowPolygons);
  }, [routeData, shadowData]);

  const pathStats = useMemo(() => {
    if (!shadyPathSections) return null;
    return calculateShadePercentages(shadyPathSections);
  }, [shadyPathSections]);

  const groupedPaths = useMemo(() => {
    if (!shadyPathSections) return null;
    return createGroupedPaths(shadyPathSections);
  }, [shadyPathSections]);

  const layers = useMemo(() => {
    if (!geojsonData) return [];
    try {
      return [
        ...((shadowData && !isMobile) ? [
          new GeoJsonLayer({
            id: 'shadows',
            data: shadowData,
            extruded: false,
            filled: true,
            getFillColor: [0, 0, 0, 80],
            getLineColor: [0, 0, 0, 0],
            getLineWidth: 0,
            lineWidthMinPixels: 0,
            parameters: {
              depthTest: false,
              depthMask: false,
              blend: true,
              blendFunc: [774, 0],
              blendEquation: 32776
            }
          })
        ] : []),
        new GeoJsonLayer({
          id: 'buildings',
          data: geojsonData,
          extruded: false,
          wireframe: false,
          filled: true,
          getElevation: 0,
          getFillColor: [220, 220, 220, 255],
          getLineColor: [180, 180, 180, 255],
          getLineWidth: 1,
          lineWidthMinPixels: 0,
          pickable: true,
        }),
    ...(routeData && groupedPaths ? [
      ...groupedPaths.sunnyPaths.map((path, index) => 
        new PathLayer({
          id: `route-sunny-${index}`,
          data: [path],
          getPath: d => d.coordinates,
          getColor: [255, 193, 7, 200], // Yellow/orange for sunny sections
          getWidth: 3,
          widthMinPixels: 3
        })
      ),
      ...groupedPaths.shadyPaths.map((path, index) => 
        new PathLayer({
          id: `route-shady-${index}`,
          data: [path],
          getPath: d => d.coordinates,
          getColor: [138, 43, 226, 200], // Purple for shady sections
          getWidth: 3,
          widthMinPixels: 3
        })
      )
    ] : routeData ? [
      // Fallback to single color if shadows are disabled
      new PathLayer({
        id: 'route',
        data: [routeData],
        getPath: d => d.coordinates,
        getColor: [0, 150, 255, 200],
        getWidth: 8,
        widthMinPixels: 3
      })
    ] : []),
    ...((startPoint || endPoint) ? [
      new ScatterplotLayer({
        id: 'waypoints',
        data: [
          ...(startPoint ? [{...startPoint, type: 'start'}] : []),
          ...(endPoint ? [{...endPoint, type: 'end'}] : [])
        ],
        getPosition: d => [d.longitude, d.latitude, 0],
        getRadius: 4,
        getFillColor: d => d.type === 'start' ? [0, 255, 0, 255] : [255, 0, 0, 255],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        radiusMinPixels: 4,
        pickable: true
      })
    ] : [])
      ];
    } catch (error) {
      console.error('Error creating layers:', error);
      return [];
    }
  }, [geojsonData, shadowData, routeData, groupedPaths, startPoint, endPoint, isMobile]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={{
          scrollZoom: { speed: 0.05, smooth: false },
          doubleClickZoom: true,
          touchRotate: false,
          touchZoom: true,
          keyboard: { moveSpeed: 100 },
          minPitch: 0,
          maxPitch: 0
        }}
        layers={layers}
        onClick={handleMapClick}
        onError={(error) => {
          console.error('DeckGL Error:', error);
          setError('3D rendering error. Try refreshing the page.');
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Map
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          mapStyle="mapbox://styles/mapbox/light-v10"
          style={{ width: '100%', height: '100%' }}
        />
      </DeckGL>
      
      <ControlPanel
        selectedDateTime={selectedDateTime}
        setSelectedDateTime={setSelectedDateTime}
        solarPosition={solarPosition}
        isSelectingStart={isSelectingStart}
        setIsSelectingStart={setIsSelectingStart}
        isSelectingEnd={isSelectingEnd}
        setIsSelectingEnd={setIsSelectingEnd}
        startPoint={startPoint}
        endPoint={endPoint}
        routeData={routeData}
        isProcessingRoute={isProcessingRoute}
        clearRoute={clearRoute}
        shadyPathSections={shadyPathSections}
        pathStats={pathStats}
      />
    </div>
  );
}

export default App;