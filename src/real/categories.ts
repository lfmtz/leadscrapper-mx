// Traduce la "clase de actividad" del DENUE (SCIAN, lenguaje oficial de INEGI)
// al término que la gente usa al buscar en Google Maps.
// Es solo una sugerencia: el usuario siempre puede editar el término antes de correr Apify.

const RULES: [RegExp, string][] = [
  [/materiales para la construcci/, 'tienda de materiales para la construcción'],
  [/ferreter|tlapaler/, 'ferretería'],
  [/vidrio|cancel/, 'vidriería'],
  [/pintura/, 'tienda de pinturas'],
  [/hojalater/, 'taller de hojalatería y pintura'],
  [/reparaci[oó]n mec[aá]nica|reparaci[oó]n y mantenimiento de autom/, 'taller mecánico'],
  [/el[eé]ctrica de autom|sistemas el[eé]ctricos de autom/, 'taller eléctrico automotriz'],
  [/llantas|c[aá]maras/, 'llantera'],
  [/partes y refacciones|refacciones/, 'refaccionaria'],
  [/lavado y lubricado|autolavado/, 'autolavado'],
  [/farmacia|productos farmac/, 'farmacia'],
  [/consultorios dentales|dentista/, 'dentista'],
  [/consultorios de medicina general/, 'consultorio médico'],
  [/laboratorios m[eé]dicos|an[aá]lisis cl[ií]nicos/, 'laboratorio de análisis clínicos'],
  [/[oó]ptic|anteojos|lentes/, 'óptica'],
  [/veterinari/, 'veterinaria'],
  [/abarrotes|ultramarinos/, 'tienda de abarrotes'],
  [/tortill/, 'tortillería'],
  [/panificaci|pan y pasteles|pan /, 'panadería'],
  [/carne de aves|pollo/, 'pollería'],
  [/carnes rojas|carnicer/, 'carnicería'],
  [/frutas y verduras/, 'frutería'],
  [/tacos|tortas/, 'taquería'],
  [/pizza/, 'pizzería'],
  [/restaurantes/, 'restaurante'],
  [/cafeter/, 'cafetería'],
  [/bebidas alcoh[oó]licas|cerveza|vinos/, 'depósito de cerveza'],
  [/papeler/, 'papelería'],
  [/salones y cl[ií]nicas de belleza|peluquer/, 'salón de belleza'],
  [/barber/, 'barbería'],
  [/gimnasio|acondicionamiento f[ií]sico/, 'gimnasio'],
  [/lavander[ií]as|tintorer/, 'lavandería'],
  [/purificaci[oó]n.*agua|agua purificada/, 'purificadora de agua'],
  [/herrer|productos met[aá]licos forjados|estructuras met[aá]licas/, 'herrería'],
  [/carpinter|productos de madera/, 'carpintería'],
  [/muebles/, 'mueblería'],
  [/ropa/, 'tienda de ropa'],
  [/calzado/, 'zapatería'],
  [/tel[eé]fonos|telefon[ií]a|celular/, 'tienda de celulares'],
  [/computadoras|c[oó]mputo/, 'tienda de computación'],
  [/cerrajer/, 'cerrajería'],
  [/escuelas|educaci[oó]n/, 'escuela'],
  [/guarder|cuidado de ni[nñ]os/, 'guardería'],
  [/hoteles/, 'hotel'],
  [/notar/, 'notaría'],
  [/contabilidad|contadores/, 'despacho contable'],
  [/bufetes jur[ií]dicos|abogados/, 'abogado'],
  [/inmobiliari/, 'inmobiliaria'],
  [/florer|flores/, 'florería'],
  [/joyer/, 'joyería'],
  [/plomer|fontaner/, 'plomero'],
  [/electricistas|instalaciones el[eé]ctricas/, 'electricista'],
  [/gas l\.?p|gas licuado/, 'gasera'],
  [/gasolina|combustibles/, 'gasolinera'],
];

const PREFIXES = [
  /^comercio al por menor (en tiendas de |de )?/,
  /^comercio al por mayor (de )?/,
  /^servicios de /,
  /^otros servicios de /,
  /^fabricaci[oó]n de /,
  /^elaboraci[oó]n de /,
  /^reparaci[oó]n y mantenimiento de /,
  /^otros? /,
];

export function suggestGoogleTerm(denueClass: string): string {
  const c = denueClass.toLowerCase();
  for (const [re, term] of RULES) {
    if (re.test(c)) return term;
  }
  let t = c;
  for (const p of PREFIXES) t = t.replace(p, '');
  t = t.replace(/\s+en general$/, '').replace(/\s+/g, ' ').trim();
  return t.slice(0, 80) || c.slice(0, 80);
}

/** Apify (Google Maps, plan gratuito): ~USD 0.004 por lugar + ~USD 0.007 por arranque de corrida. */
export const PRICE_PER_PLACE_USD = 0.004;
export const PRICE_PER_RUN_USD = 0.007;

export function estimateCostUsd(places: number, runs: number): number {
  return places * PRICE_PER_PLACE_USD + runs * PRICE_PER_RUN_USD;
}

/**
 * Cuántos registros pedir a Apify a partir del conteo de INEGI.
 * Google suele tener algo más que el DENUE (negocios nuevos o no censados),
 * así que se pide un 30 % extra, con un mínimo de 20.
 */
export function suggestedMaxPlaces(denueCount: number): number {
  return Math.max(20, Math.ceil(denueCount * 1.3));
}
