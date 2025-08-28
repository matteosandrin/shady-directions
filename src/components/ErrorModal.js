import React from 'react';

const ErrorModal = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        textAlign: 'center'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          color: '#d73027',
          fontSize: '20px'
        }}>
          Route Calculation Failed
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          color: '#aaa',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          {error.message || 'Unable to calculate a walking route between the selected points. Please try different locations or check your connection.'}
        </p>

        <button
          onClick={onClose}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;