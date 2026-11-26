// Cliente del navegador para las funciones de Netlify (/api/apify, /api/denue)
// y para la geocodificación de direcciones (OpenStreetMap / Nominatim).

const ACCESS_KEY_STORAGE = 'lsmx_access_code';

export function getAccessCode(): string {
  try { return localStorage.getItem(ACCESS_KEY_STORAGE) || ''; } catch { return ''; }
}
export function setAccessCode(code: string) {
  try { localStorage.setItem(ACCESS_KEY_STORAGE, code); } catch { /* sin almacenamiento */ }
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-key': getAccessCode() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor de la app.', 0, 'network');
  }
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok || !data) {
    if (res.status === 404) {
      throw new ApiError('No se encontró la función del servidor. ¿La app está publicada en Netlify (o corriendo con "netlify dev")?', 404, 'no_function');
    }
    throw new ApiError(data?.error || `Error ${res.status}`, res.status, data?.code);
  }
  return data as T;
}

// ─── Apify ───────────────────────────────────────────────────────────────────

export interface ApifyPlace {
  title: string;
  categoryName?: string;
  categories?: string[];
  address?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  placeId?: string;
  location?: { lat: number; lng: number };
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  searchString?: string;
}

export interface RunStatus {
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTING' | 'ABORTED' | 'TIMING-OUT' | 'TIMED-OUT';
  statusMessage: string | null;
  datasetId: string;
  itemCount: number | null;
  usageTotalUsd: number | null;
}

export const FINISHED = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']);

export const apify = {
  ping: () => post<{ ok: true; username: string; plan: string | null }>('/api/apify', { action: 'ping' }),
  start: (p: { searchTerms: string[]; lat: number; lng: number; radiusKm: number; maxPlaces: number }) =>
    post<{ runId: string; datasetId: string; status: string }>('/api/apify', { action: 'start', ...p }),
  status: (runId: string) => post<RunStatus>('/api/apify', { action: 'status', runId }),
  abort: (runId: string) => post<{ status: string }>('/api/apify', { action: 'abort', runId }),
  async allItems(datasetId: string): Promise<ApifyPlace[]> {
    const out: ApifyPlace[] = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
      const r = await post<{ items: ApifyPlace[] }>('/api/apify', { action: 'items', datasetId, offset, limit: 1000 });
      out.push(...r.items);
      if (r.items.length < 1000) break;
    }
    return out;
  },
};

// ─── INEGI DENUE ─────────────────────────────────────────────────────────────

export interface DenueClass { clase: string; total: number; conTelefono: number }
/** [lat, lng, índiceClase, nombre, índiceEstrato, tieneTelefono] */
export type DenuePoint = [number, number, number, string, number, 0 | 1];
export interface DenueResult {
  total: number;
  query: string;
  center: { lat: number; lng: number };
  radiusM: number;
  classes: DenueClass[];
  estratos: string[];
  points: DenuePoint[];
}

export const denue = {
  scan: (p: { lat: number; lng: number; radiusM: number }) => post<DenueResult>('/api/denue', p),
};

// ─── Geocodificación (OpenStreetMap Nominatim, gratis) ──────────────────────

export interface GeoHit { lat: number; lng: number; label: string; precision: string }

export async function geocodeAddress(q: string): Promise<GeoHit[]> {
  const qs = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'mx', limit: '5', addressdetails: '1', 'accept-language': 'es' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`);
  if (!res.ok) throw new Error('El buscador de direcciones no respondió. Intenta de nuevo o pon el pin a mano en el mapa.');
  const rows: any[] = await res.json();
  return rows.map(r => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    precision: r.addresstype || r.type || '',
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const qs = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18', 'accept-language': 'es' });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs}`);
    if (!res.ok) return null;
    const r = await res.json();
    return r?.display_name || null;
  } catch {
    return null;
  }
}

/** Acepta "19.3396, -99.0188" o un enlace de Google Maps con @lat,lng o !3dlat!4dlng. */
export function parseCoordinates(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&]q=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

export function insideMexico(lat: number, lng: number): boolean {
  return lat >= 14.3 && lat <= 32.8 && lng >= -118.6 && lng <= -86.6;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
