import React from 'react';

const ErrorModal = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen bg-black/80 flex items-center justify-center z-[1000]">
      <div className="bg-black/80 text-white rounded-lg p-6 max-w-md w-[90%] text-center">
        <h3 className="m-0 mb-4 text-error-red text-xl">
          Route Calculation Failed
        </h3>
        
        <p className="m-0 mb-5 text-gray-400 text-sm leading-[1.4]">
          {error.message || 'Unable to calculate a walking route between the selected points. Please try different locations or check your connection.'}
        </p>

        <button
          onClick={onClose}
          className="bg-red-600 text-white border-none rounded px-5 py-2.5 text-sm cursor-pointer transition-colors hover:bg-red-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;