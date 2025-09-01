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
    <div className="fixed bottom-2 left-2 right-2 bg-black/80 rounded-lg px-2.5 md:px-5 py-2.5 z-[1000]">
      <div className="flex flex-row items-center md:gap-5 gap-2 max-w-full">
        <div className="flex items-center justify-center gap-4 min-w-auto order-2">
          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(e) => setSelectedDateTime(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-800 text-xs min-w-auto w-auto md:min-w-[180px] md:w-[180px]"/>
        </div>
        <input
          type="range"
          min="0"
          max="1439"
          value={timeOfDay}
          onChange={handleSliderChange}
          className="flex-1 h-2 rounded outline-none cursor-pointer range-slider time-slider border border-gray-500 order-2 w-full md:order-1 md:w-auto appearance-none"/>
      </div>
    </div>
  );
};

export default TimeSlider;