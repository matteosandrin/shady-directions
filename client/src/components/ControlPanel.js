import React from 'react';

const ControlPanel = ({
  selectedDateTime,
  setSelectedDateTime,
  solarPosition,
  isSelectingStart,
  setIsSelectingStart,
  isSelectingEnd,
  setIsSelectingEnd,
  startPoint,
  endPoint,
  routeData,
  isProcessingRoute,
  clearRoute,
  shadyPathSections,
  routeStats
}) => {
  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
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

        <div style={{ marginTop: '15px', borderTop: '1px solid #555', paddingTop: '15px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Route Planning</h4>
          
          {!startPoint && !endPoint && (
            <div style={{ color: '#aaa', fontSize: '12px' }}>
              Click on map to set start point
            </div>
          )}
          
          {startPoint && !endPoint && (
            <div style={{ color: '#aaa', fontSize: '12px' }}>
              <div style={{ color: '#00ff00' }}>✓ Start point set</div>
              <div>Click on map to set end point</div>
            </div>
          )}
          
          {startPoint && endPoint && (
            <div style={{ fontSize: '12px' }}>
              <div style={{ color: '#00ff00' }}>✓ Start point set</div>
              <div style={{ color: '#00ff00' }}>✓ End point set</div>
              
              {isProcessingRoute && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #555',
                    borderTop: '2px solid #white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginRight: '8px'
                  }}></div>
                  Calculating route...
                </div>
              )}
              
              {routeData && !isProcessingRoute && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#aaa'}}>
                  <div>Distance: {(routeData.distance / 1000).toFixed(2)} km</div>
                  <div>Duration: {Math.round(routeData.duration / 60)} min</div>
                  
                  {routeStats && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid #444', paddingTop: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#fff' }}>
                        Shade Analysis:
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          backgroundColor: '#8b5cf6', 
                          marginRight: '6px',
                          borderRadius: '2px'
                        }}></div>
                        <span>Shaded: {routeStats.shadedPercentage}% ({routeStats.shadedDistance}m)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ 
                          width: '12px', 
                          height: '12px', 
                          backgroundColor: '#fbbf24', 
                          marginRight: '6px',
                          borderRadius: '2px'
                        }}></div>
                        <span>Sunny: {routeStats.sunnyPercentage}% ({routeStats.sunnyDistance}m)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {(startPoint || endPoint) && (
            <button
              onClick={clearRoute}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Route
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default ControlPanel;