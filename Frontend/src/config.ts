// Use same host as the page, backend on port 3000
export const API_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000';
