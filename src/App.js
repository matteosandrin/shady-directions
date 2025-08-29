import { BuildingShadows } from './lib/shadowShader';
import { formatDateTime, parseDateTime } from './lib/timeFormat';
import { updateRouteShade } from './lib/routeAnalysis';
import { findWalkingRoute, ROUTE_PROGRESS_STATUS, getProgressMessage } from './lib/routing';
import { debugLog, debugError, isDebugMode } from './lib/debugUtils';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import ErrorScreen from './components/ErrorScreen';
import ErrorModal from './components/ErrorModal';
import TimeSlider from './components/TimeSlider';
import DebugIndicator from './components/DebugIndicator';
import SunCalc from 'suncalc';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const manhattanCenter = { lat: 40.7128, lng: -74.006 };

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const shadowLayer = useRef(null);

  const [error] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(formatDateTime(new Date()));
  const [mapCenter, setMapCenter] = useState(manhattanCenter);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeStats, setRouteStats] = useState(null);
  const [routeProgress, setRouteProgress] = useState([]);

  const solarPosition = useMemo(() => {
    const date = parseDateTime(selectedDateTime);
    const sunPosition = SunCalc.getPosition(date, mapCenter.lat, mapCenter.lng);
    return {
      elevation: sunPosition.altitude,
      azimuth: sunPosition.azimuth
    }
  }, [selectedDateTime, mapCenter]);

  if (!isDebugMode()) {
    console.log(`Turn on debug mode: ${window.location}?debug=true`);
  }

  const fetchRoute = useCallback(async (start, end) => {
    if (!start || !end) return;

    setIsLoadingRoute(true);
    setRouteError(null);
    
    // Initialize progress steps
    const progressSteps = [
      { id: ROUTE_PROGRESS_STATUS.GETTING_WAYS_DATA, label: getProgressMessage(ROUTE_PROGRESS_STATUS.GETTING_WAYS_DATA), completed: false },
      { id: ROUTE_PROGRESS_STATUS.COMPUTING_SHADE_MAP, label: getProgressMessage(ROUTE_PROGRESS_STATUS.COMPUTING_SHADE_MAP), completed: false },
      { id: ROUTE_PROGRESS_STATUS.BUILDING_GRAPH, label: getProgressMessage(ROUTE_PROGRESS_STATUS.BUILDING_GRAPH), completed: false },
      { id: ROUTE_PROGRESS_STATUS.FINDING_ROUTE, label: getProgressMessage(ROUTE_PROGRESS_STATUS.FINDING_ROUTE), completed: false }
    ];
    setRouteProgress(progressSteps);
    
    const onProgress = (status) => {
      setRouteProgress(prevProgress => {
        const newProgress = [...prevProgress];
        
        // Mark current step as completed and update to next step
        if (status === ROUTE_PROGRESS_STATUS.GETTING_WAYS_DATA) {
          // Starting, so no previous step to complete
        } else if (status === ROUTE_PROGRESS_STATUS.COMPUTING_SHADE_MAP) {
          newProgress[0].completed = true;
        } else if (status === ROUTE_PROGRESS_STATUS.BUILDING_GRAPH) {
          newProgress[1].completed = true;
        } else if (status === ROUTE_PROGRESS_STATUS.FINDING_ROUTE) {
          newProgress[2].completed = true;
        } else if (status === ROUTE_PROGRESS_STATUS.ROUTE_COMPLETED) {
          newProgress[3].completed = true;
        }
        
        return newProgress;
      });
    };

    try {
      const date = parseDateTime(selectedDateTime);
      const options = {
        shadePreference: 0.5, // 0 = no preference, 1 = strong shade preference
        onProgress
      }
      const routeData = await findWalkingRoute(start, end, date, options);
      setRoute(routeData);
    } catch (error) {
      debugError('Error fetching route:', error);
      setRoute(null);
      setRouteError(error);
    } finally {
      setIsLoadingRoute(false);
      setRouteProgress([]);
    }
  }, [selectedDateTime]);

  const handleMapClick = useCallback((e) => {
    const { lng, lat } = e.lngLat;
    if (!startPoint) {
      debugLog('Setting start point: ', { lng, lat });
      setStartPoint({ lng, lat });
    } else if (!endPoint) {
      debugLog('Setting end point: ', { lng, lat });
      const end = { lng, lat };
      setEndPoint(end);
      fetchRoute(startPoint, end);
    } else {
      debugLog('Resetting points');
      setStartPoint({ lng, lat });
      setEndPoint(null);
      setRoute(null);
    }
  }, [startPoint, endPoint, fetchRoute]);

  const clearRoute = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setRoute(null);
    setRouteStats(null);
    setRouteError(null);
  }, []);

  const closeRouteError = useCallback(() => {
    setRouteError(null);
    clearRoute();
  }, [clearRoute]);

  // Initialize map
  useEffect(() => {
    if (!error && !map.current && mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/light-v10',
        center: [manhattanCenter.lng, manhattanCenter.lat],
        zoom: 15,
        minZoom: 15,
        pitch: 0,
        bearing: 0
      });
      map.current.on('load', () => {
        if (map.current.getLayer('building')) {
          map.current.removeLayer('building');
        }
        map.current.addLayer({
          'id': '3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'type': 'fill-extrusion',
          'filter': [
            'all',
            ['>', ['get', 'height'], 0],
            ['!=', ['get', 'underground'], 'true']
          ],
          'paint': {
            'fill-extrusion-color': '#376C85',
            'fill-extrusion-height': ["number", ["get", "height"], 5],
            'fill-extrusion-base': ["number", ["get", "min_height"], 0],
            'fill-extrusion-opacity': 1
          }
        }, 'road-label');
        shadowLayer.current = new BuildingShadows();
        map.current.addLayer(shadowLayer.current, '3d-buildings');

        const geocoder = new MapboxGeocoder({
          accessToken: mapboxgl.accessToken,
          mapboxgl: mapboxgl,
          placeholder: 'Search for places...',
          proximity: {
            longitude: manhattanCenter.lng,
            latitude: manhattanCenter.lat
          },
          flyTo: false,
          marker: false,
        });
        geocoder.on('result', (e) => {
          const coords = e.result.center;
          map.current.jumpTo({ center: coords, zoom: 15 });
          setMapCenter({ lat: coords[1], lng: coords[0] });
        });
        
        map.current.addControl(geocoder, 'top-right');
        
        map.current.on('move', () => {
          setMapCenter(map.current.getCenter());
        });
      });
    }
  }, [error]);

  // Add click handler in a separate effect
  useEffect(() => {
    if (!map.current) return;

    map.current.on('click', handleMapClick);

    return () => {
      map.current.off('click', handleMapClick);
    };
  }, [handleMapClick]);

  // Update shadow layer when solar position changes
  useEffect(() => {
    if (shadowLayer.current) {
      shadowLayer.current.updateDate(parseDateTime(selectedDateTime));
      if (route) {
        setTimeout(() => {
          const stats = updateRouteShade(route, shadowLayer.current, map.current);
          setRouteStats(stats);
        }, 100);
      }
    }
  }, [selectedDateTime, route]);

  // Handle viewport resize to redraw shadow shader
  useEffect(() => {
    if (!map.current) return;

    const handleResize = () => {
      if (shadowLayer.current && map.current) {
        // Trigger a repaint of the shadow layer by removing and re-adding it
        map.current.removeLayer(shadowLayer.current.id);
        map.current.addLayer(shadowLayer.current, '3d-buildings');
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Add/update markers when points change
  useEffect(() => {
    if (!map.current) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.route-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add start point marker
    if (startPoint) {
      const startEl = document.createElement('div');
      startEl.className = 'route-marker';
      startEl.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #00ff00;
        border: 1px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      new mapboxgl.Marker(startEl)
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(map.current);
    }

    // Add end point marker
    if (endPoint) {
      const endEl = document.createElement('div');
      endEl.className = 'route-marker';
      endEl.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #ff0000;
        border: 1px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      new mapboxgl.Marker(endEl)
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(map.current);
    }
  }, [startPoint, endPoint]);

  // Add/update route when route data changes
  useEffect(() => {
    if (!map.current) return;

    const routeSourceId = 'route';
    const routeLayerId = 'route-line';
    const shadedRouteSourceId = 'shaded-route';
    const shadedRouteLayerId = 'shaded-route-line';
    const sunnyRouteSourceId = 'sunny-route';
    const sunnyRouteLayerId = 'sunny-route-line';

    [routeLayerId, shadedRouteLayerId, sunnyRouteLayerId].forEach(layerId => {
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });
    [routeSourceId, shadedRouteSourceId, sunnyRouteSourceId].forEach(sourceId => {
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });

    if (route) {
      debugLog('Adding route to map:', route);
      map.current.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates
          }
        }
      });
      map.current.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      }, '3d-buildings');
      const stats = updateRouteShade(route, shadowLayer.current, map.current);
      setRouteStats(stats);
    }
  }, [route]);

  if (error) {
    return <ErrorScreen error={error} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <ControlPanel
        solarPosition={solarPosition}
        startPoint={startPoint}
        endPoint={endPoint}
        routeData={route}
        isProcessingRoute={isLoadingRoute}
        clearRoute={clearRoute}
        routeStats={routeStats}
        routeProgress={routeProgress}
      />

      <TimeSlider
        selectedDateTime={selectedDateTime}
        setSelectedDateTime={setSelectedDateTime}
      />

      <ErrorModal 
        error={routeError} 
        onClose={closeRouteError} 
      />

      <DebugIndicator />
    </div>
  );
}

export default App;