import React, { useState, useEffect, useMemo } from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { calculateSolarPosition, generateShadowLayer, formatDateTime, parseDateTime } from './shadowUtils';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWF0dGVvc2FuZHJpbiIsImEiOiJjajE5dHFrNTgwMDY5MnFxbXBldzA2aTliIn0.KHzhRZCopAziY_O0CJxPPw';

const INITIAL_VIEW_STATE = {
  longitude: -74.006,
  latitude: 40.7128,
  zoom: 13,
  pitch: 45,
  bearing: 0
};

function App() {
  const [geojsonData, setGeojsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(formatDateTime(new Date()));
  const [showShadows, setShowShadows] = useState(true);
  
  const manhattanCenter = { lat: 40.7128, lng: -74.006 };

  useEffect(() => {
    fetchGeojsonData();
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

  const layers = geojsonData ? [
    ...(shadowData ? [
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
      extruded: true,
      wireframe: false,
      filled: true,
      getElevation: (d) => getBuildingHeight(d),
      getFillColor: [220, 220, 220, 255],
      getLineColor: [180, 180, 180, 255],
      getLineWidth: 1,
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: ({object}) => {
        if (object) {
          const height = getBuildingHeight(object);
          console.log(`Building height: ${height}m`);
        }
      }
    })
  ] : [];

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
        controller={true}
        layers={layers}
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
        <h3 style={{ margin: '0 0 10px 0' }}>3D Manhattan Buildings</h3>
        <p style={{ margin: '0 0 5px 0' }}>
          Buildings: {geojsonData?.features?.length || 0}
        </p>
        <p style={{ margin: '0 0 10px 0', color: '#ccc' }}>
          Hover over buildings to see height data
        </p>
        
        <div style={{ borderTop: '1px solid #444', paddingTop: '10px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Shadow Simulation</h4>
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Date & Time:
            </label>
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
          
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showShadows}
                onChange={(e) => setShowShadows(e.target.checked)}
                style={{ marginRight: '6px' }}
              />
              Show Shadows
            </label>
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
      </div>
    </div>
  );
}

export default App;