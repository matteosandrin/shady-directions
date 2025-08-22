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
  pathStats
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
          
          {isProcessingRoute && (
            <div style={{ 
              fontSize: '11px', 
              color: '#4CAF50', 
              marginTop: '8px',
              padding: '6px 8px',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              borderRadius: '4px',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #4CAF50',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Computing walking route...
            </div>
          )}

          {routeData && !isProcessingRoute && (
            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
              Route: {(routeData.distance / 1000).toFixed(2)}km, {Math.round(routeData.duration / 60)}min
            </div>
          )}
          
          {routeData && shadyPathSections && pathStats && (
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
    </>
  );
};

export default ControlPanel;