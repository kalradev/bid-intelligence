// Call backend directly so API always hits the Python server. Set VITE_API_PORT in .env if backend uses another port.
const BACKEND_PORT = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_PORT ? Number(import.meta.env.VITE_API_PORT) : 3000;
export const API_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`
    : `http://localhost:${BACKEND_PORT}`;
