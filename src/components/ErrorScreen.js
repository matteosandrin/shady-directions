import React from 'react';

const ErrorScreen = ({ error }) => {
  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-gray-900 text-red-400 text-lg text-center p-5">
      <div>
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <p className="text-sm text-gray-300 mt-5">
          Make sure manhattan.geojson is in the project root directory
        </p>
      </div>
    </div>
  );
};

export default ErrorScreen;