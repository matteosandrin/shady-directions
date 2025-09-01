import React, { useMemo, useCallback } from 'react';

const TimeSlider = ({ selectedDateTime, setSelectedDateTime }) => {
  
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
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 px-5 py-2.5 border-t border-gray-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-[1000] backdrop-blur-[10px]">
      <div className="flex md:flex-row flex-col md:items-center items-stretch md:gap-5 gap-2 max-w-full">
        {/* DateTime picker - shows first on mobile (above slider) */}
        <div className="flex items-center justify-center md:justify-start gap-4 min-w-auto order-1 md:min-w-[200px] md:order-2">
          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(e) => setSelectedDateTime(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-800 text-xs min-w-auto w-auto md:min-w-[180px] md:w-[180px]"/>
        </div>
        
        {/* Time slider - shows second on mobile (below datetime picker) */}
        <input
          type="range"
          min="0"
          max="1439"
          value={timeOfDay}
          onChange={handleSliderChange}
          className="flex-1 h-2 rounded outline-none cursor-pointer range-slider time-slider order-2 w-full md:order-1 md:w-auto appearance-none"/>
      </div>
    </div>
  );
};

export default TimeSlider;