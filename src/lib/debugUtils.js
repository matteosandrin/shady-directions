export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
}

export function isDebugMode() {
  const params = getUrlParams();
  return params.debug === 'true';
}

export function debugLog(...args) {
  if (isDebugMode()) {
    console.log('[DEBUG]', ...args);
  }
}

export function debugWarn(...args) {
  if (isDebugMode()) {
    console.warn('[DEBUG]', ...args);
  }
}

export function debugError(...args) {
  if (isDebugMode()) {
    console.error('[DEBUG]', ...args);
  }
}

// Global debug state for storing debug images
let debugState = {
  shadowSamplerImage: null
};

export function setDebugImage(imageDataUrl) {
  if (isDebugMode()) {
    debugState.shadowSamplerImage = imageDataUrl;
    debugLog('Debug image updated');
  }
}

export function getDebugImage() {
  return debugState.shadowSamplerImage;
}