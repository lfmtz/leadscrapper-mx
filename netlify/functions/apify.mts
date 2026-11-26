// Función de Netlify: puente seguro hacia Apify (actor compass/crawler-google-places).
// Acciones (POST JSON { action, ... }):
//   ping   -> verifica que el token funcione y regresa el usuario de Apify
//   start  -> lanza una corrida en un radio alrededor de un punto
//   status -> estado de la corrida, registros obtenidos y costo en USD
//   items  -> registros de la corrida (paginado)
//   abort  -> detiene una corrida
import { checkAccess, env, insideMexico, isFiniteNumber, json, readBody } from '../lib/shared.mts';

const API = 'https://api.apify.com/v2';
const ACTOR = 'compass~crawler-google-places';
const ID_RE = /^[A-Za-z0-9]{5,40}$/;

const FIELDS = [
  'title', 'categoryName', 'categories', 'address', 'street', 'neighborhood', 'city', 'postalCode', 'state',
  'phone', 'phoneUnformatted', 'website', 'totalScore', 'reviewsCount', 'url', 'placeId', 'location',
  'permanentlyClosed', 'temporarilyClosed', 'searchString',
].join(',');

type Body = {
  action?: string;
  searchTerms?: unknown;
  lat?: unknown;
  lng?: unknown;
  radiusKm?: unknown;
  maxPlaces?: unknown;
  runId?: unknown;
  datasetId?: unknown;
  offset?: unknown;
  limit?: unknown;
};

async function apify(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function apifyError(r: { status: number; data: any }) {
  const msg = r.data?.error?.message || r.data?.raw || 'Error desconocido de Apify';
  const status = r.status === 401 || r.status === 403 ? 502 : r.status >= 500 ? 502 : 400;
  return json({ error: `Apify respondió ${r.status}: ${msg}`, code: 'apify_error' }, status);
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  const denied = checkAccess(req);
  if (denied) return denied;

  const token = env('APIFY_TOKEN');
  if (!token) {
    return json({ error: 'Falta APIFY_TOKEN en las variables de entorno de Netlify.', code: 'missing_token' }, 500);
  }

  const body = await readBody<Body>(req);
  if (!body?.action) return json({ error: 'Falta "action".' }, 400);

  switch (body.action) {
    case 'ping': {
      const r = await apify('/users/me', token);
      if (!r.ok) return apifyError(r);
      const u = r.data?.data || {};
      return json({ ok: true, username: u.username, plan: u.plan?.id || null });
    }

    case 'start': {
      const { lat, lng, radiusKm } = body;
      const terms = Array.isArray(body.searchTerms)
        ? body.searchTerms.filter((t): t is string => typeof t === 'string' && t.trim().length > 1).map(t => t.trim().slice(0, 120))
        : [];
      if (!terms.length || terms.length > 10) return json({ error: 'Envía de 1 a 10 términos de búsqueda.' }, 400);
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !insideMexico(lat, lng)) {
        return json({ error: 'La ubicación no es válida o está fuera de México.' }, 400);
      }
      if (!isFiniteNumber(radiusKm) || radiusKm < 0.2 || radiusKm > 50) {
        return json({ error: 'El radio debe estar entre 0.2 y 50 km.' }, 400);
      }
      const cap = Number(env('MAX_PLACES_PER_RUN') || 1000);
      const requested = isFiniteNumber(body.maxPlaces) ? Math.floor(body.maxPlaces) : 50;
      if (requested < 1) return json({ error: 'maxPlaces debe ser al menos 1.' }, 400);
      if (requested > cap) {
        return json({ error: `Máximo ${cap} registros por término (límite MAX_PLACES_PER_RUN).`, code: 'over_cap' }, 400);
      }

      const input = {
        searchStringsArray: terms,
        // GeoJSON: [longitud, latitud]
        customGeolocation: { type: 'Point', coordinates: [lng, lat], radiusKm },
        maxCrawledPlacesPerSearch: requested,
        language: 'es-419',
        // Sin add-ons de pago: reseñas, imágenes, contactos, detalle.
        maxReviews: 0,
        maxImages: 0,
        maxQuestions: 0,
        scrapePlaceDetailPage: false,
        scrapeContacts: false,
        includeWebResults: false,
      };
      const r = await apify(`/acts/${ACTOR}/runs`, token, { method: 'POST', body: JSON.stringify(input) });
      if (!r.ok) return apifyError(r);
      const run = r.data?.data || {};
      return json({ runId: run.id, datasetId: run.defaultDatasetId, status: run.status });
    }

    case 'status': {
      if (typeof body.runId !== 'string' || !ID_RE.test(body.runId)) return json({ error: 'runId inválido.' }, 400);
      const r = await apify(`/actor-runs/${body.runId}`, token);
      if (!r.ok) return apifyError(r);
      const run = r.data?.data || {};
      let itemCount: number | null = null;
      if (run.defaultDatasetId) {
        const d = await apify(`/datasets/${run.defaultDatasetId}`, token);
        if (d.ok) itemCount = d.data?.data?.itemCount ?? null;
      }
      return json({
        status: run.status,
        statusMessage: run.statusMessage || null,
        datasetId: run.defaultDatasetId,
        itemCount,
        usageTotalUsd: run.usageTotalUsd ?? null,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || null,
      });
    }

    case 'items': {
      if (typeof body.datasetId !== 'string' || !ID_RE.test(body.datasetId)) return json({ error: 'datasetId inválido.' }, 400);
      const offset = isFiniteNumber(body.offset) ? Math.max(0, Math.floor(body.offset)) : 0;
      const limit = isFiniteNumber(body.limit) ? Math.min(1000, Math.max(1, Math.floor(body.limit))) : 1000;
      const qs = new URLSearchParams({ clean: 'true', format: 'json', fields: FIELDS, offset: String(offset), limit: String(limit) });
      const r = await apify(`/datasets/${body.datasetId}/items?${qs}`, token);
      if (!r.ok) return apifyError(r);
      return json({ items: Array.isArray(r.data) ? r.data : [], offset, limit });
    }

    case 'abort': {
      if (typeof body.runId !== 'string' || !ID_RE.test(body.runId)) return json({ error: 'runId inválido.' }, 400);
      const r = await apify(`/actor-runs/${body.runId}/abort`, token, { method: 'POST' });
      if (!r.ok) return apifyError(r);
      return json({ status: r.data?.data?.status });
    }

    default:
      return json({ error: `Acción desconocida: ${body.action}` }, 400);
  }
};

export const config = { path: '/api/apify' };
