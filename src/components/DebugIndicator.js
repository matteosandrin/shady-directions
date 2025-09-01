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
        className="fixed top-0 right-0 w-[58px] h-[58px] cursor-pointer z-[1000] select-none flex items-center justify-center"
        title="Debug Mode Active - Click to toggle debug panel">
        <div className="w-4 h-4 bg-red-500 rounded-full debug-indicator-shadow animate-pulse"/>
      </div>

      {showPanel && (
        <div className="fixed top-2.5 right-2.5 w-80 max-h-96 bg-black/90 border border-gray-700 rounded-lg text-white text-xs font-mono z-[1000] shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-3 border-b border-gray-700 bg-orange-500/10 font-bold flex justify-between items-center">
            Debug Panel
            <button
              onClick={togglePanel}
              className="bg-transparent border-none text-white cursor-pointer text-base p-0 w-5 h-5">
              ×
            </button>
          </div>
          <div className="p-3 max-h-80 overflow-y-auto">
            <div className="mb-2">
              <strong>User Agent:</strong> {navigator.userAgent}
            </div>
            <div className="mb-2">
              <strong>Viewport:</strong> {window.innerWidth}×{window.innerHeight}
            </div>
            {debugImage && (
              <button
                onClick={() => openBase64InNewTab(debugImage.split(',')[1], 'image/png')}
                className="bg-transparent border-none text-green-400 underline cursor-pointer p-0 font-inherit leading-6">
                View sampling points image
              </button>
            )}
            <div>
              <a
                href="/"
                className="text-green-400 underline leading-6">
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