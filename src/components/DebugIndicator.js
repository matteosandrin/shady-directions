import { useState } from 'react';
import { isDebugMode, getDebugImage } from '../lib/debugUtils';

function DebugIndicator() {
  const [showPanel, setShowPanel] = useState(false);
  
  if (!isDebugMode()) {
    return null;
  }

  const togglePanel = () => {
    setShowPanel(!showPanel);
  };

  const debugImage = getDebugImage();

  return (
    <>
      <div 
        onClick={togglePanel}
        style={{
          position: 'fixed',
          top: '0px',
          right: '0px',
          width: '82px',
          height: '82px',
          cursor: 'pointer',
          zIndex: 1000,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Debug Mode Active - Click to toggle debug panel"
      >
        <div 
          style={{
            width: '16px',
            height: '16px',
            backgroundColor: '#ff0000',
            borderRadius: '50%',
            boxShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000',
            animation: 'pulse 2s infinite'
          }}
        />
      </div>
      <style>
        {`
          @keyframes pulse {
            0% {
              box-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000;
            }
            50% {
              box-shadow: 0 0 15px #ff0000, 0 0 30px #ff0000, 0 0 45px #ff0000;
            }
            100% {
              box-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000;
            }
          }
        `}
      </style>
      
      {showPanel && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: '320px',
            maxHeight: '400px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid #333',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}
        >
          <div 
            style={{
              padding: '12px',
              borderBottom: '1px solid #333',
              backgroundColor: 'rgba(255, 107, 53, 0.1)',
              fontWeight: 'bold',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            Debug Panel
            <button 
              onClick={togglePanel}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                width: '20px',
                height: '20px'
              }}
            >
              ×
            </button>
          </div>
          <div 
            style={{
              padding: '12px',
              maxHeight: '320px',
              overflowY: 'auto'
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <strong>User Agent:</strong> {navigator.userAgent}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Viewport:</strong> {window.innerWidth}×{window.innerHeight}
            </div>
            {debugImage && (
              <button
                onClick={() => openBase64InNewTab(debugImage.split(',')[1], 'image/png')}
                style={{ 
                  background: 'none',
                  border: 'none',
                  color: '#4ade80',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '0',
                  font: 'inherit',
                  lineHeight: '1.5'
                }}
              >
                View sampling points image
              </button>
            )}
            <div>
              <a
                href="/"
                style={{ 
                  color: '#4ade80',
                  textDecoration: 'underline',
                  lineHeight: '1.5'
                }}
                >
                Turn off debug mode
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function openBase64InNewTab(data, mimeType) {
  var byteCharacters = atob(data);
  var byteNumbers = new Array(byteCharacters.length);

  for (var i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  var byteArray = new Uint8Array(byteNumbers);

  var file = new Blob([byteArray], {
    type: mimeType + ";base64",
  });

  var fileURL = URL.createObjectURL(file);

  window.open(fileURL, "_blank");
}

export default DebugIndicator;