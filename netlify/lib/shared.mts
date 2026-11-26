// Utilidades compartidas por las funciones de Netlify.
// Los tokens (APIFY_TOKEN, INEGI_TOKEN) viven solo aquí, en variables de entorno
// del sitio en Netlify; nunca se envían al navegador.

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Las funciones son públicas en internet. Si APP_ACCESS_CODE está definido,
 * se exige que el navegador mande ese código en la cabecera x-app-key,
 * para que nadie más pueda gastar tus créditos de Apify.
 */
export function checkAccess(req: Request): Response | null {
  const code = env('APP_ACCESS_CODE');
  if (!code) return null;
  if (req.headers.get('x-app-key') !== code) {
    return json({ error: 'Código de acceso incorrecto.', code: 'bad_access_code' }, 401);
  }
  return null;
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Validación básica: la coordenada debe estar dentro de la caja de México. */
export function insideMexico(lat: number, lng: number): boolean {
  return lat >= 14.3 && lat <= 32.8 && lng >= -118.6 && lng <= -86.6;
}
