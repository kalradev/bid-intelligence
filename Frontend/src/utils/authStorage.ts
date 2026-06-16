const TOKEN_KEY = "token";
const USER_KEY = "user";

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Embedded browsers (e.g. Cursor Simple Browser) may block storage APIs.
  }
}

export function getAuthToken(): string | null {
  return readStorage(localStorage, TOKEN_KEY) ?? readStorage(sessionStorage, TOKEN_KEY);
}

export function getAuthUser<T = Record<string, unknown>>(): T | null {
  const raw =
    readStorage(localStorage, USER_KEY) ?? readStorage(sessionStorage, USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuthSession(token: string, user: unknown): void {
  const userJson = JSON.stringify(user);
  writeStorage(localStorage, TOKEN_KEY, token);
  writeStorage(localStorage, USER_KEY, userJson);
  writeStorage(sessionStorage, TOKEN_KEY, token);
  writeStorage(sessionStorage, USER_KEY, userJson);
}

export function clearAuthSession(): void {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
  }
}
