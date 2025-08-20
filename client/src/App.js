import React, { useState, useEffect } from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';

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

  useEffect(() => {
    fetchGeojsonData();
  }, []);

  const fetchGeojsonData = async () => {
    try {
      const response = await fetch('/api/manhattan-geojson');
      const result = await response.json();
      
      if (result.success) {
        setGeojsonData(result.data);
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

  const layers = geojsonData ? [
    new GeoJsonLayer({
      id: 'buildings',
      data: geojsonData,
      extruded: true,
      wireframe: false,
      filled: true,
      getElevation: (d) => getBuildingHeight(d),
      getFillColor: [74, 80, 87, 200],
      getLineColor: [255, 255, 255, 80],
      getLineWidth: 1,
      lineWidthMinPixels: 0.5,
      pickable: true,
      onHover: ({object, x, y}) => {
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
          mapStyle="mapbox://styles/mapbox/dark-v10"
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
        <p style={{ margin: '0', color: '#ccc' }}>
          Hover over buildings to see height data
        </p>
      </div>
    </div>
  );
}

export default App;