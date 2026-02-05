// Backend API URL - use port 3001 if backend runs with PORT=3001 in .env
export const API_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001';
