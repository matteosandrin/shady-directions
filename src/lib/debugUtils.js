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