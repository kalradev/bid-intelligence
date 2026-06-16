// API URL: in dev, use same-origin (empty) so Vite proxies /api → backend (works in Cursor embedded browser).
// In production, use VITE_API_BASE_URL or hostname:port for direct backend access.
const BACKEND_PORT =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_PORT
    ? Number(import.meta.env.VITE_API_PORT)
    : 3000;
const API_HOST =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_HOST
    ? String(import.meta.env.VITE_API_HOST)
    : null;
const API_BASE_FALLBACK =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL)
    : null;

function buildDirectApiUrl(hostname: string, protocol: string): string {
  if (API_BASE_FALLBACK) return API_BASE_FALLBACK;
  if (API_HOST) return `${protocol}//${API_HOST}:${BACKEND_PORT}`;
  return `${protocol}//${hostname}:${BACKEND_PORT}`;
}

export const API_BASE_URL =
  typeof window !== "undefined"
    ? import.meta.env.DEV
      ? ""
      : buildDirectApiUrl(window.location.hostname, window.location.protocol)
    : API_BASE_FALLBACK ||
      (API_HOST ? `http://${API_HOST}:${BACKEND_PORT}` : `http://127.0.0.1:${BACKEND_PORT}`);
