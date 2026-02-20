// API URL: use env for production/network IP. In browser, uses hostname (or VITE_API_HOST) so same machine or network IP works.
const BACKEND_PORT = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_PORT ? Number(import.meta.env.VITE_API_PORT) : 3000;
const API_HOST = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_HOST ? String(import.meta.env.VITE_API_HOST) : null;
const API_BASE_FALLBACK = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL ? String(import.meta.env.VITE_API_BASE_URL) : null;
export const API_BASE_URL =
  typeof window !== "undefined"
    ? API_HOST
      ? `${window.location.protocol}//${API_HOST}:${BACKEND_PORT}`
      : `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`
    : API_BASE_FALLBACK || (API_HOST ? `http://${API_HOST}:${BACKEND_PORT}` : `http://127.0.0.1:${BACKEND_PORT}`);
