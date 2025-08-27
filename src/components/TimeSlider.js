import React, { useMemo, useState, useEffect, useCallback } from 'react';

const TimeSlider = ({ selectedDateTime, setSelectedDateTime }) => {
  // Track screen size for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Parse selectedDateTime to get timeOfDay in minutes since midnight
  const timeOfDay = useMemo(() => {
    const date = new Date(selectedDateTime);
    return date.getHours() * 60 + date.getMinutes();
  }, [selectedDateTime]);

  const handleSliderChange = useCallback((e) => {
    const newTimeOfDay = parseInt(e.target.value);
    
    // Update selectedDateTime with new time while preserving the date
    const currentDate = new Date(selectedDateTime);
    const hours = Math.floor(newTimeOfDay / 60);
    const minutes = newTimeOfDay % 60;
    
    const newDate = new Date(currentDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    
    // Format to match the datetime-local input format
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    const hour = String(newDate.getHours()).padStart(2, '0');
    const minute = String(newDate.getMinutes()).padStart(2, '0');
    
    const formattedDateTime = `${year}-${month}-${day}T${hour}:${minute}`;
    setSelectedDateTime(formattedDateTime);
  }, [selectedDateTime, setSelectedDateTime]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      padding: '10px 20px',
      borderTop: '1px solid #e0e0e0',
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '10px' : '20px',
        maxWidth: '100%'
      }}>
        {/* DateTime picker - shows first on mobile (above slider) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'center' : 'flex-start',
          gap: '15px',
          minWidth: isMobile ? 'auto' : '200px',
          order: isMobile ? 1 : 2
        }}>
          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(e) => setSelectedDateTime(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#333',
              fontSize: '12px',
              minWidth: isMobile ? 'auto' : '180px',
              width: isMobile ? 'auto' : '180px'
            }}
          />
        </div>
        
        {/* Time slider - shows second on mobile (below datetime picker) */}
        <input
          type="range"
          min="0"
          max="1439"
          value={timeOfDay}
          onChange={handleSliderChange}
          style={{
            flex: 1,
            height: '8px',
            borderRadius: '4px',
            background: `linear-gradient(
              to right,
              #1a1a2e 0%,
              #16213e 20%,
              #ffa726 30%,
              #ffcc02 40%,
              #87ceeb 50%,
              #ffcc02 60%,
              #ffa726 70%,
              #16213e 80%,
              #1a1a2e 100%
            )`,
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            order: isMobile ? 2 : 1,
            width: isMobile ? '100%' : 'auto'
          }}
        />
      </div>
      
      <style jsx="true">{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #333;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #333;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
        }
        
        input[type="range"]::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default TimeSlider;