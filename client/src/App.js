import React, { useState, useEffect, useMemo } from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { calculateSolarPosition, generateShadowLayer, formatDateTime, parseDateTime } from './shadowUtils';
import { getShadyPathSections, calculateShadePercentages, createGroupedPaths } from './pathIntersection';

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
  const [showShadows, setShowShadows] = useState(true);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const manhattanCenter = { lat: 40.7128, lng: -74.006 };


  useEffect(() => {
    fetchGeojsonData();
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
      const response = await fetch('/api/manhattan-geojson');
      const result = await response.json();
      
      if (result.success) {
        const processedData = processGeojsonData(result.data);
        setGeojsonData(processedData);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError('Error connecting to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoute = async (start, end) => {
    try {
      const response = await fetch('/api/directions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ start, end }),
      });
      const result = await response.json();
      
      if (result.success) {
        setRouteData(result.route);
      } else {
        console.error('Route calculation failed:', result.error);
      }
    } catch (err) {
      console.error('Error fetching route:', err);
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
  };

  const getBuildingHeight = (feature) => {
    const properties = feature.properties || {};
    const height = properties.height || properties.HEIGHT || properties.elevation || properties.ELEVATION || 20;
    return Math.max(height, 0);
  };

  const solarPosition = useMemo(() => {
    const date = parseDateTime(selectedDateTime);
    return calculateSolarPosition(date, manhattanCenter.lat, manhattanCenter.lng);
  }, [selectedDateTime, manhattanCenter.lat, manhattanCenter.lng]);

  const shadowData = useMemo(() => {
    if (!geojsonData || !showShadows) return null;
    return generateShadowLayer(geojsonData.features, solarPosition);
  }, [geojsonData, solarPosition, showShadows]);

  const shadyPathSections = useMemo(() => {
    if (!routeData || !shadowData || !showShadows) return null;
    
    const pathCoordinates = routeData.coordinates;
    const shadowPolygons = shadowData.features;
    
    return getShadyPathSections(pathCoordinates, shadowPolygons);
  }, [routeData, shadowData, showShadows]);

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
  }, [geojsonData, shadowData, routeData, groupedPaths, startPoint, endPoint]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: 'white',
        fontSize: '18px'
      }}>
        Loading Manhattan buildings...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: '#ff6b6b',
        fontSize: '18px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h2>Error Loading Data</h2>
          <p>{error}</p>
          <p style={{fontSize: '14px', color: '#ccc', marginTop: '20px'}}>
            Make sure manhattan.geojson is in the project root directory
          </p>
        </div>
      </div>
    );
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
      
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        maxWidth: '300px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Shade walking directions</h3>
        <div>
          <div style={{ marginBottom: '8px' }}>
            <input
              type="datetime-local"
              value={selectedDateTime}
              onChange={(e) => setSelectedDateTime(e.target.value)}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #555',
                borderRadius: '4px',
                backgroundColor: '#333',
                color: 'white',
                fontSize: '12px'
              }}
            />
          </div>
          
          {solarPosition && (
            <div style={{ fontSize: '11px', color: '#aaa' }}>
              <div>Sun elevation: {(solarPosition.elevation * 180 / Math.PI).toFixed(1)}°</div>
              <div>Sun azimuth: {(solarPosition.azimuth * 180 / Math.PI).toFixed(1)}°</div>
              {solarPosition.elevation <= 0 && (
                <div style={{ color: '#ff6b6b', marginTop: '4px' }}>Sun is below horizon</div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ borderTop: '1px solid #444', paddingTop: '10px', marginTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Walking Directions</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => {
                setIsSelectingStart(true);
                setIsSelectingEnd(false);
              }}
              disabled={isSelectingStart}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                backgroundColor: isSelectingStart ? '#4CAF50' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSelectingStart ? 'default' : 'pointer'
              }}
            >
              {isSelectingStart ? 'Click map for start...' : 'Set Start Point'}
            </button>
            
            <button
              onClick={() => {
                setIsSelectingEnd(true);
                setIsSelectingStart(false);
              }}
              disabled={isSelectingEnd}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                backgroundColor: isSelectingEnd ? '#f44336' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSelectingEnd ? 'default' : 'pointer'
              }}
            >
              {isSelectingEnd ? 'Click map for end...' : 'Set End Point'}
            </button>
            
            {(startPoint || endPoint || routeData) && (
              <button
                onClick={clearRoute}
                style={{
                  padding: '6px 8px',
                  fontSize: '11px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear Route
              </button>
            )}
          </div>
          
          {startPoint && (
            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
              Start: {startPoint.latitude.toFixed(4)}, {startPoint.longitude.toFixed(4)}
            </div>
          )}
          
          {endPoint && (
            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
              End: {endPoint.latitude.toFixed(4)}, {endPoint.longitude.toFixed(4)}
            </div>
          )}
          
          {routeData && (
            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
              Route: {(routeData.distance / 1000).toFixed(2)}km, {Math.round(routeData.duration / 60)}min
            </div>
          )}
          
          {routeData && shadyPathSections && showShadows && pathStats && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Path Analysis:</div>
              
              <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '3px', backgroundColor: '#FFC107' }}></div>
                    <span>Sunny</span>
                  </div>
                  <span>{pathStats.sunPercentage}% ({pathStats.sunnyDistance}m)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '3px', backgroundColor: '#8A2BE2' }}></div>
                    <span>Shady</span>
                  </div>
                  <span>{pathStats.shadePercentage}% ({pathStats.shadyDistance}m)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;