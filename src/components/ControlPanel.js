import { useState, useEffect, useRef } from 'react';
import { exportRouteAsGPX } from '../lib/gpxExport';
import { debugError } from '../lib/debugUtils';

const ControlPanel = ({
  solarPosition,
  startPoint,
  endPoint,
  routeData,
  isProcessingRoute,
  clearRoute,
  routeStats,
  routeProgress,
  onGeolocate
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

  const handleGPXExport = () => {
    try {
      exportRouteAsGPX(routeData, routeStats);
    } catch (error) {
      debugError('Failed to export GPX:', error);
      alert('Failed to export route as GPX file');
    }
  };

  return (
    <div className="absolute top-2 left-2 right-2 bg-black/80 text-white p-4 rounded-lg text-sm md:max-w-[280px]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Shady walking directions</h3>
          {onGeolocate && (
            <button
              onClick={onGeolocate}
              className="px-3 py-1.5 bg-blue-600 text-white border-none rounded cursor-pointer text-xs hover:bg-blue-700 transition-colors"
            >
              📍
            </button>
          )}
        </div>
        <div className="hidden md:block">
          <div className="text-xs text-gray-400 mt-1">
            Made by <a className="text-gray-400" href="https://sandr.in" target="_blank" rel="noreferrer">Matteo Sandrin</a>
          </div>
          <p className="mt-4">
            Plan a walking route that maximizes shade, based on the current sun position.
          </p>
        </div>
        <div className="mt-4">
          <div>
            {solarPosition && (!routeData || routeData.length === 0) && (
              <div className="text-xs text-gray-400">
                <div>Sun elevation: {(solarPosition.elevation * 180 / Math.PI).toFixed(1)}°</div>
                <div>Sun azimuth: {(solarPosition.azimuth * 180 / Math.PI).toFixed(1)}°</div>
                {solarPosition.elevation <= 0 && (
                  <div className="text-red-400 mt-1">Sun is below horizon</div>
                )}
              </div>
            )}
          </div>
          <div className="mt-4">
            {!startPoint && !endPoint && (
              <div className="text-white text-xs font-bold">
                ↓ Click on map to set start point
              </div>
            )}
            
            {startPoint && !endPoint && !routeData && (
              <div className="text-white text-xs">
                <div className="text-start-marker">✓ Start point set</div>
                <div className="mt-1.5 font-bold">↓ Click on map to set end point</div>
              </div>
            )}
            
            {startPoint && endPoint && (
              <div className="text-xs">
                { !routeData && <div>
                  <div className="text-start-marker">✓ Start point set</div>
                  <div className="text-start-marker mt-1.5">✓ End point set</div>
                </div>}
                
                {isProcessingRoute && (
                  <div className="mt-2">
                    <div className="text-xs font-bold mb-1.5">
                      Calculating route...
                    </div>
                    {routeProgress && routeProgress.length > 0 && (
                      <div className="text-xs">
                        {routeProgress.map((step, index) => (
                          <div key={step.id} className={`flex items-center justify-between mb-1 ${
                            step.completed ? 'text-start-marker' : 'text-gray-400'
                          }`}>
                            <div className="flex items-center">
                              <div className="w-3 h-3 mr-1.5 flex items-center justify-center">
                                {step.completed ? '✓' : 
                                (index === routeProgress.findIndex(s => !s.completed) ? 
                                  <div className="w-2 h-2 border-2 border-gray-600 border-t-white border-r-white rounded-full animate-spin"></div> : '○'
                                )
                                }
                              </div>
                              {step.label}
                            </div>
                            <div className="text-xs font-mono text-gray-500 min-w-[35px] text-right">
                              {getStepTiming(step, index)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {routeData && !isProcessingRoute && (
                  <div className="text-xs text-gray-400">
                    <div>Total distance: {(routeData.distance / 1000).toFixed(2)} km ({Math.round(routeData.duration / 60)} min)</div>                
                    {routeStats && (
                      <div className="mt-2">
                        <div className="flex items-center mb-0.5">
                          <div className="w-3 h-3 bg-shaded-route mr-1.5 rounded-sm"></div>
                          <span>Shaded: {routeStats.shadedPercentage}% ({routeStats.shadedDistance}m)</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-sunny-route mr-1.5 rounded-sm"></div>
                          <span>Sunny: {routeStats.sunnyPercentage}% ({routeStats.sunnyDistance}m)</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {(startPoint || endPoint) && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={clearRoute}
                  className={`px-4 py-2 bg-red-600 text-white border-none rounded cursor-pointer text-xs hover:bg-red-700 transition-colors ${
                    routeData && !isProcessingRoute ? 'flex-1' : 'w-full'
                  }`}
                >
                  Clear Route
                </button>
                {routeData && !isProcessingRoute && (
                  <button
                    onClick={handleGPXExport}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white border-none rounded cursor-pointer text-xs hover:bg-blue-700 transition-colors"
                  >
                    Export GPX
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default ControlPanel;