import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { calculateSolarPosition, formatDateTime, parseDateTime } from './shadowUtils';
import { BuildingShadows } from './shadowShader';
import { updateRouteShade } from './route';
import ErrorScreen from './components/ErrorScreen';
import ControlPanel from './components/ControlPanel';

// Import Mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const manhattanCenter = { lat: 40.7128, lng: -74.006 };

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const shadowLayer = useRef(null);

  const [error] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(formatDateTime(new Date()));
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeStats, setRouteStats] = useState(null);

  const solarPosition = useMemo(() => {
    const date = parseDateTime(selectedDateTime);
    return calculateSolarPosition(date, manhattanCenter.lat, manhattanCenter.lng);
  }, [selectedDateTime]);

  const fetchRoute = useCallback(async (start, end) => {
    if (!start || !end) return;

    setIsLoadingRoute(true);
    try {
      const response = await fetch('/directions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: {
            latitude: start.lat,
            longitude: start.lng
          },
          end: {
            latitude: end.lat,
            longitude: end.lng
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const routeData = await response.json();
      setRoute(routeData.route);
    } catch (error) {
      console.error('Error fetching route:', error);
      setRoute(null);
    } finally {
      setIsLoadingRoute(false);
    }
  }, []);

  const handleMapClick = useCallback((e) => {
    const { lng, lat } = e.lngLat;
    if (!startPoint) {
      console.log('Setting start point');
      setStartPoint({ lng, lat });
    } else if (!endPoint) {
      console.log('Setting end point');
      const end = { lng, lat };
      setEndPoint(end);
      fetchRoute(startPoint, end);
    } else {
      console.log('Resetting points');
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
  }, []);

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

      // Add buildings layer when map loads
      map.current.on('load', () => {
        // Remove default building layer if it exists
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

        // Add GPU-accelerated shadow layer
        shadowLayer.current = new BuildingShadows();
        map.current.addLayer(shadowLayer.current, '3d-buildings');
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
      
      const startMarker = new mapboxgl.Marker(startEl)
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
      
      const endMarker = new mapboxgl.Marker(endEl)
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

    // Remove existing route layers
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

    // Add new route
    if (route) {
      console.log('Adding route to map:', route);
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
        selectedDateTime={selectedDateTime}
        setSelectedDateTime={setSelectedDateTime}
        solarPosition={solarPosition}
        startPoint={startPoint}
        endPoint={endPoint}
        routeData={route}
        isProcessingRoute={isLoadingRoute}
        clearRoute={clearRoute}
        routeStats={routeStats}
      />
    </div>
  );
}

export default App;