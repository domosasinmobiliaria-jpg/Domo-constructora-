// Cliente HTTP central. Nunca hardcodear URLs: se lee de expo-constants (app.json extra).
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'domo_token';

function resolveBaseUrl(): string {
  // 1) Variable explícita (útil en desarrollo web: EXPO_PUBLIC_API_URL=http://localhost:8000).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // 2) En web servido desde el mismo host que el backend (despliegue de un solo
  //    servicio), usar el mismo origen: /api pega contra el mismo servidor.
  // @ts-ignore
  if (typeof window !== 'undefined' && window.location?.origin) {
    // @ts-ignore
    return String(window.location.origin).replace(/\/$/, '');
  }

  // 3) Fallback (móvil nativo): valor de app.json → extra.apiUrl.
  const extra =
    (Constants.expoConfig?.extra as any) ||
    (Constants.manifest2?.extra as any) ||
    {};
  return String(extra.apiUrl || 'http://localhost:8000').replace(/\/$/, '');
}

export const API_BASE = resolveBaseUrl();
export const API_URL = `${API_BASE}/api`;

// En web, expo-secure-store puede no estar disponible: se degrada a localStorage.
function webStorage(): Storage | null {
  // @ts-ignore
  return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
}

export async function saveToken(token: string) {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    webStorage()?.setItem(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (t) return t;
  } catch {
    // ignora y prueba fallback
  }
  return webStorage()?.getItem(TOKEN_KEY) ?? null;
}

export async function clearToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignora
  }
  webStorage()?.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
  raw?: boolean; // devolver Response cruda (para descargas)
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, raw = false } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw) return res as unknown as T;

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `Error ${res.status}`;
    throw new ApiError(
      typeof detail === 'string' ? detail : 'Ocurrió un error',
      res.status
    );
  }
  return data as T;
}

// Helpers específicos.
export const authApi = {
  adminExists: () => api<{ exists: boolean }>('/auth/admin-exists', { auth: false }),
  login: (email: string, password: string) =>
    api('/auth/login', { method: 'POST', auth: false, body: { email, password } }),
  register: (payload: any) =>
    api('/auth/register', { method: 'POST', auth: false, body: payload }),
  me: () => api('/auth/me'),
};

export function attachmentContentUrl(id: string): string {
  return `${API_URL}/attachments/${id}/content`;
}
