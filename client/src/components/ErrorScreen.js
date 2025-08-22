import React from 'react';

const ErrorScreen = ({ error }) => {
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
};

export default ErrorScreen;