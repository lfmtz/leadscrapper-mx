// Función de Netlify: consulta el DENUE de INEGI (gratis) alrededor de un punto.
// POST JSON { lat, lng, radiusM, q? }
// Regresa el conteo por clase de actividad (giro) y los puntos para el mapa.
// La respuesta va compacta porque en zonas densas el DENUE regresa miles de negocios.
import { checkAccess, env, insideMexico, isFiniteNumber, json, readBody } from '../lib/shared.mts';

const DENUE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar';
const MAX_RADIUS_M = 5000; // límite del propio DENUE

type Body = { lat?: unknown; lng?: unknown; radiusM?: unknown; q?: unknown };

function pick(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);
  const denied = checkAccess(req);
  if (denied) return denied;

  const token = env('INEGI_TOKEN');
  if (!token) {
    return json({ error: 'Falta INEGI_TOKEN en las variables de entorno de Netlify.', code: 'missing_token' }, 500);
  }

  const body = await readBody<Body>(req);
  const { lat, lng, radiusM } = body || {};
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !insideMexico(lat, lng)) {
    return json({ error: 'La ubicación no es válida o está fuera de México.' }, 400);
  }
  if (!isFiniteNumber(radiusM) || radiusM < 100 || radiusM > MAX_RADIUS_M) {
    return json({ error: `El radio para INEGI debe estar entre 100 y ${MAX_RADIUS_M} metros.` }, 400);
  }
  const rawQ = typeof body?.q === 'string' ? body.q.trim() : '';
  const q = rawQ && /^[\p{L}\p{N} ]{2,60}$/u.test(rawQ) ? rawQ : 'todos';

  const url = `${DENUE}/${encodeURIComponent(q)}/${lat.toFixed(6)},${lng.toFixed(6)}/${Math.round(radiusM)}/${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  let text: string;
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    text = await res.text();
    if (!res.ok) return json({ error: `INEGI respondió ${res.status}.`, code: 'inegi_error' }, 502);
  } catch (e: any) {
    const timeout = e?.name === 'AbortError';
    return json({
      error: timeout
        ? 'INEGI tardó demasiado. Prueba con un radio más chico (por ejemplo 1.5 km).'
        : 'No se pudo conectar con INEGI.',
      code: timeout ? 'inegi_timeout' : 'inegi_unreachable',
    }, 504);
  } finally {
    clearTimeout(timer);
  }

  if (/no autorizado/i.test(text)) {
    return json({ error: 'INEGI rechazó el token. Revisa INEGI_TOKEN en Netlify.', code: 'inegi_bad_token' }, 502);
  }

  let rows: Record<string, any>[] = [];
  try {
    const parsed = JSON.parse(text);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    // El DENUE responde texto plano cuando no hay resultados.
    rows = [];
  }

  const classIndex = new Map<string, number>();
  const classes: { clase: string; total: number; conTelefono: number }[] = [];
  const estratoIndex = new Map<string, number>();
  const estratos: string[] = [];
  // Punto compacto: [lat, lng, índiceClase, nombre, índiceEstrato, tieneTelefono]
  const points: [number, number, number, string, number, 0 | 1][] = [];

  for (const row of rows) {
    const plat = Number(pick(row, 'Latitud', 'latitud'));
    const plng = Number(pick(row, 'Longitud', 'longitud'));
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const clase = pick(row, 'Clase_actividad', 'clase_actividad') || 'Sin clasificar';
    const estrato = pick(row, 'Estrato', 'estrato') || 'N/D';
    const tel = pick(row, 'Telefono', 'telefono') ? 1 : 0;

    let ci = classIndex.get(clase);
    if (ci === undefined) {
      ci = classes.length;
      classIndex.set(clase, ci);
      classes.push({ clase, total: 0, conTelefono: 0 });
    }
    classes[ci].total++;
    classes[ci].conTelefono += tel;

    let ei = estratoIndex.get(estrato);
    if (ei === undefined) {
      ei = estratos.length;
      estratoIndex.set(estrato, ei);
      estratos.push(estrato);
    }

    const nombre = pick(row, 'Nombre', 'nombre').slice(0, 60);
    points.push([Number(plat.toFixed(6)), Number(plng.toFixed(6)), ci, nombre, ei, tel as 0 | 1]);
  }

  return json({
    total: points.length,
    query: q,
    center: { lat, lng },
    radiusM: Math.round(radiusM),
    classes,
    estratos,
    points,
  });
};

export const config = { path: '/api/denue' };
