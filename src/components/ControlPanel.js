import { useState, useEffect, useRef } from 'react';

const ControlPanel = ({
  solarPosition,
  startPoint,
  endPoint,
  routeData,
  isProcessingRoute,
  clearRoute,
  routeStats,
  routeProgress
}) => {
  const [stepTimings, setStepTimings] = useState({});
  const [currentStepStartTime, setCurrentStepStartTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const recordedSteps = useRef(new Set());

  // Track step changes and timing
  useEffect(() => {
    if (!routeProgress || routeProgress.length === 0) {
      setStepTimings({});
      setCurrentStepStartTime(null);
      recordedSteps.current.clear();
      return;
    }

    const currentStepIndex = routeProgress.findIndex(s => !s.completed);
    const currentStep = currentStepIndex >= 0 ? routeProgress[currentStepIndex] : null;

    if (currentStep && !currentStepStartTime) {
      // Starting a new step
      setCurrentStepStartTime(Date.now());
    } else if (currentStepIndex === -1 && currentStepStartTime) {
      // All steps completed, record final step timing
      const lastCompletedStep = routeProgress[routeProgress.length - 1];
      if (lastCompletedStep && !recordedSteps.current.has(lastCompletedStep.id)) {
        const duration = Date.now() - currentStepStartTime;
        setStepTimings(prev => ({
          ...prev,
          [lastCompletedStep.id]: duration
        }));
        recordedSteps.current.add(lastCompletedStep.id);
      }
      setCurrentStepStartTime(null);
    } else if (currentStep && currentStepStartTime) {
      // Check if we moved to a different step
      const prevCompletedIndex = currentStepIndex - 1;
      if (prevCompletedIndex >= 0) {
        const prevStep = routeProgress[prevCompletedIndex];
        if (prevStep.completed && !recordedSteps.current.has(prevStep.id)) {
          // Previous step just completed
          const duration = Date.now() - currentStepStartTime;
          setStepTimings(prev => ({
            ...prev,
            [prevStep.id]: duration
          }));
          recordedSteps.current.add(prevStep.id);
          setCurrentStepStartTime(Date.now()); // Start timing the new step
        }
      }
    }
  }, [routeProgress, currentStepStartTime]);

  // Live timer update
  useEffect(() => {
    let interval;
    if (isProcessingRoute && currentStepStartTime) {
      interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 100); // Update every 100ms for smooth display
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessingRoute, currentStepStartTime]);

  // Helper function to get step timing display
  const getStepTiming = (step, index) => {
    if (stepTimings[step.id]) {
      return `${(stepTimings[step.id] / 1000).toFixed(1)}s`;
    } else if (step.completed) {
      return '...';
    } else if (currentStepStartTime && index === routeProgress.findIndex(s => !s.completed)) {
      const elapsed = currentTime - currentStepStartTime;
      return `${(elapsed / 1000).toFixed(1)}s`;
    }
    return '';
  };

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
        maxWidth: '220px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Shady walking directions</h3>
        <div style={{ fontSize: '11px', color: '#aaa' }}>
          Made by <a style={{ color: '#aaa' }} href="https://sandr.in" target="_blank" rel="noreferrer">Matteo Sandrin</a>
        </div>
        <p>
          Plan a walking route that maximizes shade, based on the current sun position.
        </p>
        <div style={{ marginTop: '15px', borderTop: '1px solid #555', paddingTop: '15px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Route Planning</h4>
          <div>
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
          <div style={{ marginTop: '10px' }}>
            {!startPoint && !endPoint && (
              <div style={{ color: 'white', fontSize: '12px' }}>
                Click on map to set start point
              </div>
            )}
            
            {startPoint && !endPoint && (
              <div style={{ color: 'white', fontSize: '12px'}}>
                <div style={{ color: '#00ff00' }}>✓ Start point set</div>
                <div style={{ marginTop: '5px' }}>Click on map to set end point</div>
              </div>
            )}
            
            {startPoint && endPoint && (
              <div style={{ fontSize: '12px' }}>
                <div style={{ color: '#00ff00' }}>✓ Start point set</div>
                <div style={{ color: '#00ff00', marginTop: '5px' }}>✓ End point set</div>
                
                {isProcessingRoute && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                      Calculating route...
                    </div>
                    {routeProgress && routeProgress.length > 0 && (
                      <div style={{ fontSize: '11px' }}>
                        {routeProgress.map((step, index) => (
                          <div key={step.id} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '3px',
                            color: step.completed ? '#00ff00' : '#aaa'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{
                                width: '12px',
                                height: '12px',
                                marginRight: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {step.completed ? '✓' : 
                                (index === routeProgress.findIndex(s => !s.completed) ? 
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    border: '2px solid #555',
                                    borderTop: '2px solid #fff',
                                    borderRight: '2px solid #fff',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                  }}></div> : '○'
                                )
                                }
                              </div>
                              {step.label}
                            </div>
                            <div style={{ 
                              fontSize: '10px', 
                              fontFamily: 'monospace',
                              color: '#888',
                              minWidth: '35px',
                              textAlign: 'right'
                            }}>
                              {getStepTiming(step, index)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {routeData && !isProcessingRoute && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#aaa'}}>
                    <div>Distance: {(routeData.distance / 1000).toFixed(2)} km</div>
                    <div>Duration: {Math.round(routeData.duration / 60)} min</div>
                    
                    {routeStats && (
                      <div style={{ marginTop: '15px', borderTop: '1px solid #444', paddingTop: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'white'}}>
                          Shade Analysis
                        </h4>
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
                  marginTop: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  width: '100%'
                }}
              >
                Clear Route
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ControlPanel;