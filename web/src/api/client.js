/**
 * API istemcisi.
 * Access token bellekte tutulur (XSS'te localStorage'dan calinmasin diye);
 * kalicilik httpOnly refresh cookie ile saglanir. 401 alinca bir kez refresh denenir.
 *
 * BASE_URL varsayilan olarak bostur: istekler ayni origin'e (`/api/...`) gider ve
 * Vercel/Vite bunlari API'ye proxy'ler. Boylece refresh cerezi birinci taraf kalir;
 * ayri bir alan adina gitseydi Safari ve gizli sekmedeki Chrome cerezi engelledigi
 * icin sayfa her yenilendiginde oturum dusrdu.
 * VITE_API_URL yalnizca proxy'siz (dogrudan API'ye giden) kurulumlar icin.
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let accessToken = null;
let onUnauthorized = null;

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function rawRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) throw new ApiError(res.status, data?.error || 'Bir hata olustu.', data?.code);
  return data;
}

/** Ayni anda birden fazla 401 gelirse tek bir refresh istegi yapilir. */
let refreshPromise = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'Oturum yenilenemedi.');
        const data = await res.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (err) {
    // Bu uclarda 401 zaten beklenen sonuc; refresh denemek sonsuz donguye yol acar
    const skipRefresh = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(
      path
    );
    if (err instanceof ApiError && err.status === 401 && !skipRefresh) {
      try {
        await refreshSession();
        return await rawRequest(path, options);
      } catch {
        accessToken = null;
        onUnauthorized?.();
      }
    }
    throw err;
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  refreshSession,
};
