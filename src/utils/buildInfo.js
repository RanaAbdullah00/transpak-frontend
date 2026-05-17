/** Expose active frontend build id on window for production verification. */
export function initTranspakBuildInfo() {
  const buildId = import.meta.env.VITE_APP_BUILD_ID || 'dev';
  const payload = {
    build: buildId,
    mode: import.meta.env.MODE,
    apiUrl: import.meta.env.VITE_API_URL || null,
    loadedAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    window.__TRANSPAK_BUILD__ = payload;
  }

  // eslint-disable-next-line no-console
  console.log('TRANSPAK ACTIVE BUILD LOADED', buildId);

  return buildId;
}
