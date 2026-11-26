import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle, CheckCircle2, Download, KeyRound, Loader2, LocateFixed, MapPin, Play, PlugZap,
  RefreshCw, Search, Square, Store,
} from 'lucide-react';
import {
  ApiError, ApifyPlace, DenueResult, FINISHED, GeoHit, RunStatus, apify, denue, distanceKm,
  geocodeAddress, getAccessCode, insideMexico, parseCoordinates, reverseGeocode, setAccessCode,
} from './api';
import { estimateCostUsd, suggestGoogleTerm, suggestedMaxPlaces } from './categories';
import { ProspectMap, MapPlace } from './ProspectMap';

type LatLng = { lat: number; lng: number };
type LocationSource = 'gps' | 'direccion' | 'coordenadas' | 'mapa';

interface Location extends LatLng {
  source: LocationSource;
  accuracyM?: number;
  label?: string;
}

interface Pick {
  key: string;          // clase DENUE o término manual
  denueIndex: number | null;
  denueCount: number | null;
  term: string;
  maxPlaces: number;
}

interface RunState {
  key: string;
  term: string;
  runId: string;
  datasetId: string;
  status: RunStatus['status'] | 'STARTING' | 'ERROR';
  itemCount: number;
  usd: number;
  error?: string;
}

interface Batch {
  center: LatLng;
  radiusKm: number;
  label: string;
  runs: RunState[];
  createdAt: string;
}

const LAST_BATCH_KEY = 'lsmx_last_batch';

function loadLastBatch(): Batch | null {
  try {
    const raw = localStorage.getItem(LAST_BATCH_KEY);
    return raw ? (JSON.parse(raw) as Batch) : null;
  } catch { return null; }
}
function saveLastBatch(b: Batch) {
  try { localStorage.setItem(LAST_BATCH_KEY, JSON.stringify(b)); } catch { /* sin almacenamiento */ }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function waLink(phoneUnformatted?: string): string {
  const d = (phoneUnformatted || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('52')) return `https://wa.me/${d}`;
  if (d.length === 10) return `https://wa.me/52${d}`;
  return '';
}

const card = 'bg-[#130E22] border border-[#2D1B4E] rounded-2xl p-4 sm:p-5';
const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btn} bg-gradient-to-r from-[#6B21A8] to-[#9333EA] hover:from-[#9333EA] hover:to-[#A855F7] text-white`;
const btnGhost = `${btn} border border-[#6B21A8]/60 hover:border-[#9333EA] bg-[#1E1635] text-[#E9D5FF]`;
const input = 'w-full bg-[#0A0713] border border-[#2D1B4E] focus:border-[#9333EA] outline-none rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B7AA8]';

const StepTitle: React.FC<{ n: number; title: string; done?: boolean; children?: React.ReactNode }> = ({ n, title, done, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h2 className="flex items-center gap-2 font-bold text-base sm:text-lg">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${done ? 'bg-emerald-500 text-[#0A0713]' : 'bg-[#9333EA]'}`}>
        {done ? '✓' : n}
      </span>
      {title}
    </h2>
    {children}
  </div>
);

const Notice: React.FC<{ kind: 'warn' | 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ kind, children }) => {
  const styles = {
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
    ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    info: 'border-[#6B21A8]/50 bg-[#1E1635] text-[#E9D5FF]',
  }[kind];
  return <div className={`border rounded-lg px-3 py-2 text-sm ${styles}`}>{children}</div>;
};

export default function RealProspector() {
  // ── Conexión ──
  const [accessCode, setAccessCodeState] = useState(getAccessCode());
  const [conn, setConn] = useState<{ state: 'idle' | 'testing' | 'ok' | 'error'; msg?: string; sample?: ApifyPlace | null }>({ state: 'idle' });

  // ── Ubicación ──
  const [location, setLocation] = useState<Location | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [radiusKm, setRadiusKm] = useState(2);
  const [addressQuery, setAddressQuery] = useState('');
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState('');

  // ── INEGI ──
  const [denueResult, setDenueResult] = useState<DenueResult | null>(null);
  const [denueBusy, setDenueBusy] = useState(false);
  const [denueError, setDenueError] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [manualTerm, setManualTerm] = useState('');

  // ── Selección y corridas ──
  const [picks, setPicks] = useState<Pick[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [runError, setRunError] = useState('');
  const [places, setPlaces] = useState<ApifyPlace[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const pollRef = useRef<number | null>(null);
  const [lastBatch] = useState<Batch | null>(loadLastBatch());

  // ── Filtros de resultados ──
  const [onlyInside, setOnlyInside] = useState(true);
  const [skipClosed, setSkipClosed] = useState(true);
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set());

  // Cualquier cambio de ubicación o radio obliga a reconfirmar y re-escanear
  const moveTo = (loc: Location) => {
    setLocation(loc);
    setConfirmed(false);
    setDenueResult(null);
    setGeoHits([]);
    setLocError(insideMexico(loc.lat, loc.lng) ? '' : 'Ese punto está fuera de México.');
  };

  const fillLabel = async (lat: number, lng: number) => {
    const label = await reverseGeocode(lat, lng);
    if (label) setLocation(prev => (prev && prev.lat === lat && prev.lng === lng ? { ...prev, label } : prev));
  };

  const useGps = () => {
    if (!navigator.geolocation) { setLocError('Este navegador no permite obtener la ubicación.'); return; }
    setLocBusy(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocBusy(false);
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        moveTo({ lat, lng, source: 'gps', accuracyM: Math.round(accuracy) });
        fillLabel(lat, lng);
      },
      err => {
        setLocBusy(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? 'Bloqueaste el permiso de ubicación. Actívalo en el candado de la barra de direcciones, o escribe tu dirección.'
          : 'No se pudo obtener tu ubicación. Escribe tu dirección o pon el pin en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const searchAddress = async () => {
    const q = addressQuery.trim();
    if (!q) return;
    const coords = parseCoordinates(q);
    if (coords) {
      moveTo({ ...coords, source: 'coordenadas' });
      fillLabel(coords.lat, coords.lng);
      return;
    }
    setLocBusy(true);
    setLocError('');
    try {
      const hits = await geocodeAddress(q);
      if (!hits.length) setLocError('No encontré esa dirección. Prueba con calle, número, colonia y alcaldía/municipio, o pega las coordenadas de Google Maps.');
      else if (hits.length === 1) moveTo({ lat: hits[0].lat, lng: hits[0].lng, source: 'direccion', label: hits[0].label });
      else setGeoHits(hits);
    } catch (e) {
      setLocError(errText(e));
    } finally {
      setLocBusy(false);
    }
  };

  const onMapPick = (lat: number, lng: number) => {
    moveTo({ lat, lng, source: 'mapa' });
    fillLabel(lat, lng);
  };

  // ── Fase 1: prueba de conexión (1 registro real) ──
  const testConnection = async () => {
    setAccessCode(accessCode);
    setConn({ state: 'testing', msg: 'Verificando token de Apify…' });
    try {
      const me = await apify.ping();
      const c = location ?? { lat: 19.4326, lng: -99.1332 };
      setConn({ state: 'testing', msg: `Token correcto (cuenta ${me.username}, plan ${me.plan ?? 'N/D'}). Bajando 1 registro de prueba…` });
      const run = await apify.start({ searchTerms: ['ferretería'], lat: c.lat, lng: c.lng, radiusKm: 2, maxPlaces: 1 });
      let st: RunStatus | null = null;
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 3000));
        st = await apify.status(run.runId);
        if (FINISHED.has(st.status)) break;
      }
      if (!st || st.status !== 'SUCCEEDED') throw new Error(`La corrida de prueba terminó con estado ${st?.status ?? 'desconocido'}.`);
      const items = await apify.allItems(run.datasetId);
      setConn({
        state: 'ok',
        msg: `Conexión correcta con la cuenta ${me.username}. Costo de la prueba: USD ${(st.usageTotalUsd ?? 0).toFixed(4)}.`,
        sample: items[0] ?? null,
      });
    } catch (e) {
      const msg = e instanceof ApiError && e.code === 'bad_access_code'
        ? 'Código de acceso incorrecto. Es el valor de APP_ACCESS_CODE en Netlify.'
        : errText(e);
      setConn({ state: 'error', msg });
    }
  };

  // ── Fase 3/4: escaneo INEGI ──
  const scanDenue = async () => {
    if (!location) return;
    setDenueBusy(true);
    setDenueError('');
    try {
      setAccessCode(accessCode);
      const r = await denue.scan({ lat: location.lat, lng: location.lng, radiusM: Math.round(radiusKm * 1000) });
      setDenueResult(r);
      if (!r.total) setDenueError('INEGI no regresó negocios en esta zona. Revisa el pin o agranda el radio.');
    } catch (e) {
      setDenueError(errText(e));
    } finally {
      setDenueBusy(false);
    }
  };

  const rankedClasses = useMemo(() => {
    if (!denueResult) return [];
    return denueResult.classes
      .map((c, i) => ({ ...c, index: i }))
      .sort((a, b) => b.total - a.total)
      .map((c, rank) => ({ ...c, rank: rank + 1, pct: (c.total / Math.max(1, denueResult.total)) * 100 }));
  }, [denueResult]);

  const visibleClasses = useMemo(() => {
    const f = classFilter.trim().toLowerCase();
    return f ? rankedClasses.filter(c => c.clase.toLowerCase().includes(f)) : rankedClasses;
  }, [rankedClasses, classFilter]);

  const highlight = useMemo(
    () => new Set(picks.filter(p => p.denueIndex !== null).map(p => p.denueIndex as number)),
    [picks],
  );

  const togglePick = (c: { clase: string; index: number; total: number }) => {
    setPicks(prev => prev.some(p => p.key === c.clase)
      ? prev.filter(p => p.key !== c.clase)
      : [...prev, { key: c.clase, denueIndex: c.index, denueCount: c.total, term: suggestGoogleTerm(c.clase), maxPlaces: suggestedMaxPlaces(c.total) }]);
  };

  const addManual = () => {
    const t = manualTerm.trim();
    if (t.length < 2 || picks.some(p => p.key === t)) return;
    setPicks(prev => [...prev, { key: t, denueIndex: null, denueCount: null, term: t, maxPlaces: 100 }]);
    setManualTerm('');
  };

  const updatePick = (key: string, patch: Partial<Pick>) =>
    setPicks(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)));

  const totalRequested = picks.reduce((a, p) => a + (p.maxPlaces || 0), 0);
  const estCost = estimateCostUsd(totalRequested, picks.length);

  // ── Fase 5: corridas de Apify ──
  const stopPolling = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => stopPolling, []);

  const poll = (b: Batch) => {
    stopPolling();
    const tick = async () => {
      const runs = await Promise.all(b.runs.map(async r => {
        if (!r.runId || FINISHED.has(r.status) || r.status === 'ERROR') return r;
        try {
          const st = await apify.status(r.runId);
          return { ...r, status: st.status, itemCount: st.itemCount ?? r.itemCount, usd: st.usageTotalUsd ?? r.usd };
        } catch (e) {
          return { ...r, error: errText(e) };
        }
      }));
      b = { ...b, runs };
      setBatch(b);
      saveLastBatch(b);
      if (runs.every(r => FINISHED.has(r.status) || r.status === 'ERROR')) {
        stopPolling();
        loadItems(b);
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 5000);
  };

  const loadItems = async (b: Batch) => {
    setLoadingItems(true);
    try {
      const all: ApifyPlace[] = [];
      for (const r of b.runs) {
        if (r.datasetId && r.status !== 'ERROR') all.push(...(await apify.allItems(r.datasetId)));
      }
      const seen = new Set<string>();
      const unique = all.filter(p => {
        const id = p.placeId || `${p.title}|${p.address}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setPlaces(unique);
      setExcludedCats(new Set());
    } catch (e) {
      setRunError(errText(e));
    } finally {
      setLoadingItems(false);
    }
  };

  const startRuns = async () => {
    if (!location || !confirmed || !picks.length) return;
    const bad = picks.find(p => p.term.trim().length < 2 || !(p.maxPlaces >= 1));
    if (bad) { setRunError(`Revisa el término y la cantidad de "${bad.key}".`); return; }
    const ok = window.confirm(
      `Se van a pedir hasta ${totalRequested.toLocaleString('es-MX')} registros a Apify en ${picks.length} corrida(s).\n` +
      `Costo máximo estimado: USD ${estCost.toFixed(2)} (solo se cobra lo que realmente encuentre).\n\n¿Continuar?`,
    );
    if (!ok) return;
    setAccessCode(accessCode);
    setRunError('');
    setPlaces([]);
    const center = { lat: location.lat, lng: location.lng };
    const runs: RunState[] = [];
    for (const p of picks) {
      try {
        const r = await apify.start({ searchTerms: [p.term.trim()], lat: center.lat, lng: center.lng, radiusKm, maxPlaces: Math.floor(p.maxPlaces) });
        runs.push({ key: p.key, term: p.term.trim(), runId: r.runId, datasetId: r.datasetId, status: 'READY', itemCount: 0, usd: 0 });
      } catch (e) {
        runs.push({ key: p.key, term: p.term.trim(), runId: '', datasetId: '', status: 'ERROR', itemCount: 0, usd: 0, error: errText(e) });
      }
    }
    const b: Batch = { center, radiusKm, label: location.label || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`, runs, createdAt: new Date().toISOString() };
    setBatch(b);
    saveLastBatch(b);
    poll(b);
  };

  const abortAll = async () => {
    if (!batch) return;
    await Promise.all(batch.runs.filter(r => r.runId && !FINISHED.has(r.status)).map(r => apify.abort(r.runId).catch(() => null)));
  };

  const recoverLast = () => {
    if (!lastBatch) return;
    setBatch(lastBatch);
    setLocation({ ...lastBatch.center, source: 'mapa', label: lastBatch.label });
    setRadiusKm(lastBatch.radiusKm);
    setConfirmed(true);
    poll(lastBatch);
  };

  // ── Resultados ──
  const center = batch?.center ?? location;
  const enriched = useMemo(() => places.map(p => {
    const d = center && p.location ? distanceKm(center, p.location) : null;
    return { ...p, distKm: d, inside: d !== null && d <= (batch?.radiusKm ?? radiusKm) + 0.05 };
  }), [places, center, batch?.radiusKm, radiusKm]);

  const googleCats = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of enriched) m.set(p.categoryName || 'Sin categoría', (m.get(p.categoryName || 'Sin categoría') || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [enriched]);

  const finalRows = useMemo(() => enriched.filter(p =>
    (!onlyInside || p.inside) &&
    (!skipClosed || (!p.permanentlyClosed && !p.temporarilyClosed)) &&
    !excludedCats.has(p.categoryName || 'Sin categoría'),
  ), [enriched, onlyInside, skipClosed, excludedCats]);

  const mapPlaces: MapPlace[] = useMemo(() => enriched.filter(p => p.location).map(p => ({
    lat: p.location!.lat, lng: p.location!.lng, title: p.title, subtitle: `${p.categoryName || ''} · ${p.phone || 'sin teléfono'}`, inside: p.inside,
  })), [enriched]);

  const exportExcel = () => {
    const rows = finalRows.map(p => ({
      'Nombre': p.title,
      'Categoría Google': p.categoryName || '',
      'Otras categorías': (p.categories || []).join(', '),
      'Teléfono': p.phone || '',
      'WhatsApp': waLink(p.phoneUnformatted),
      'Dirección': p.address || '',
      'Colonia': p.neighborhood || '',
      'C.P.': p.postalCode || '',
      'Ciudad': p.city || '',
      'Estado': p.state || '',
      'Sitio web': p.website || '',
      'Calificación': p.totalScore ?? '',
      'Reseñas': p.reviewsCount ?? '',
      'Distancia (km)': p.distKm !== null ? Number(p.distKm.toFixed(2)) : '',
      'Latitud': p.location?.lat ?? '',
      'Longitud': p.location?.lng ?? '',
      'Google Maps': p.url || '',
      'Término buscado': p.searchString || '',
      'Fecha de extracción': new Date().toLocaleDateString('es-MX'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 26 }, { wch: 60 }, { wch: 24 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 40 }, { wch: 30 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prospectos');
    const resumen = [
      { Dato: 'Ubicación', Valor: batch?.label || '' },
      { Dato: 'Coordenadas', Valor: center ? `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : '' },
      { Dato: 'Radio (km)', Valor: batch?.radiusKm ?? radiusKm },
      { Dato: 'Términos buscados', Valor: (batch?.runs || []).map(r => r.term).join(' | ') },
      { Dato: 'Registros exportados', Valor: rows.length },
      { Dato: 'Costo Apify (USD)', Valor: Number((batch?.runs || []).reduce((a, r) => a + (r.usd || 0), 0).toFixed(4)) },
      { Dato: 'Fuente', Valor: 'Google Maps vía Apify (compass/crawler-google-places)' },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    const slug = (batch?.runs[0]?.term || 'prospectos').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    XLSX.writeFile(wb, `leads_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const running = !!batch && batch.runs.some(r => !FINISHED.has(r.status) && r.status !== 'ERROR');
  const batchUsd = (batch?.runs || []).reduce((a, r) => a + (r.usd || 0), 0);
  const gpsImprecise = location?.source === 'gps' && (location.accuracyM ?? 0) > 150;

  return (
    <div className="min-h-screen bg-[#0A0713] text-white">
      <header className="border-b border-[#2D1B4E] bg-[#130E22]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9333EA] to-[#C084FC] flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight">LeadScrapper MX</h1>
            <p className="text-[11px] text-[#C084FC]/80 hidden sm:block">Datos reales: INEGI (DENUE) + Google Maps vía Apify</p>
          </div>
        </div>
        <a href="?demo=1" className="text-[11px] text-[#8B7AA8] hover:text-[#C084FC] underline">Versión anterior (simulada)</a>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        {/* ── CONEXIÓN ── */}
        <section className={card}>
          <StepTitle n={0} title="Conexión con Apify" done={conn.state === 'ok'} />
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7AA8]" />
              <input
                className={`${input} pl-9`}
                type="password"
                placeholder="Código de acceso de la app (APP_ACCESS_CODE)"
                value={accessCode}
                onChange={e => { setAccessCodeState(e.target.value); if (conn.state === 'error') setConn({ state: 'idle' }); }}
                onBlur={() => setAccessCode(accessCode)}
              />
            </div>
            <button className={btnPrimary} onClick={testConnection} disabled={conn.state === 'testing'}>
              {conn.state === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
              Probar con 1 registro real
            </button>
          </div>
          {conn.msg && (
            <div className="mt-3">
              <Notice kind={conn.state === 'ok' ? 'ok' : conn.state === 'error' ? 'error' : 'info'}>{conn.msg}</Notice>
            </div>
          )}
          {conn.sample && (
            <div className="mt-3 text-sm bg-[#0A0713] border border-[#2D1B4E] rounded-lg p-3">
              <div className="font-bold">{conn.sample.title}</div>
              <div className="text-[#C084FC] text-xs">{conn.sample.categoryName}</div>
              <div className="text-[#E9D5FF]/80 text-xs mt-1">{conn.sample.address}</div>
              <div className="text-xs mt-1">📞 {conn.sample.phone || 'sin teléfono'} · ⭐ {conn.sample.totalScore ?? '—'} ({conn.sample.reviewsCount ?? 0} reseñas)</div>
              {conn.sample.url && <a className="text-xs text-[#C084FC] underline" href={conn.sample.url} target="_blank" rel="noreferrer">Ver en Google Maps</a>}
            </div>
          )}
          {lastBatch && !batch && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#E9D5FF]/80">
              <span>Tienes una descarga anterior ({new Date(lastBatch.createdAt).toLocaleString('es-MX')}, {lastBatch.runs.map(r => r.term).join(', ')}).</span>
              <button className={btnGhost} onClick={recoverLast}><RefreshCw className="w-3.5 h-3.5" /> Recuperarla</button>
            </div>
          )}
        </section>

        {/* ── 1. UBICACIÓN ── */}
        <section className={card}>
          <StepTitle n={1} title="¿Dónde vas a prospectar?" done={confirmed} />
          <div className="grid md:grid-cols-[1fr_auto] gap-2">
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="Dirección (calle, número, colonia, municipio) o coordenadas / enlace de Google Maps"
                value={addressQuery}
                onChange={e => setAddressQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchAddress()}
              />
              <button className={btnGhost} onClick={searchAddress} disabled={locBusy}><Search className="w-4 h-4" /><span className="hidden sm:inline">Buscar</span></button>
            </div>
            <button className={btnPrimary} onClick={useGps} disabled={locBusy}>
              {locBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} Usar mi ubicación
            </button>
          </div>

          {geoHits.length > 1 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-[#E9D5FF]/70">Encontré varias coincidencias, elige la correcta:</div>
              {geoHits.map((h, i) => (
                <button key={i} className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-[#0A0713] border border-[#2D1B4E] hover:border-[#9333EA]"
                  onClick={() => moveTo({ lat: h.lat, lng: h.lng, source: 'direccion', label: h.label })}>
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-[#C084FC]" />{h.label}
                </button>
              ))}
            </div>
          )}

          {locError && <div className="mt-2"><Notice kind="error">{locError}</Notice></div>}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Radio:
              <input type="range" min={0.5} max={5} step={0.5} value={radiusKm}
                onChange={e => { setRadiusKm(Number(e.target.value)); setConfirmed(false); setDenueResult(null); }} />
              <b>{radiusKm} km</b>
            </label>
            <span className="text-xs text-[#8B7AA8]">Máximo 5 km (límite de INEGI). Se usa el mismo radio en INEGI y en Apify.</span>
          </div>

          <div className="mt-3">
            <ProspectMap
              center={location}
              radiusKm={radiusKm}
              onPick={onMapPick}
              denuePoints={denueResult?.points}
              denueClasses={denueResult?.classes.map(c => c.clase)}
              highlightClasses={highlight}
              places={mapPlaces}
            />
            <p className="text-[11px] text-[#8B7AA8] mt-1">Haz clic en el mapa o arrastra el pin morado para ajustar el punto exacto.</p>
          </div>

          {location && (
            <div className="mt-3 space-y-2">
              <Notice kind="info">
                <div><b>Punto:</b> {location.lat.toFixed(6)}, {location.lng.toFixed(6)} <span className="text-[#8B7AA8]">({{ gps: 'GPS / ubicación del equipo', direccion: 'dirección', coordenadas: 'coordenadas', mapa: 'puesto en el mapa' }[location.source]})</span></div>
                {location.label && <div className="text-xs mt-0.5 text-[#E9D5FF]/80">{location.label}</div>}
              </Notice>
              {gpsImprecise && (
                <Notice kind="warn">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Tu laptop da una ubicación aproximada (±{location.accuracyM} m), porque calcula por Wi-Fi, no por GPS. Revisa el mapa y arrastra el pin a tu ubicación real antes de confirmar.
                </Notice>
              )}
              {location.source === 'direccion' && (
                <Notice kind="warn">El buscador de direcciones puede quedar a unas cuadras. Verifica en el mapa y ajusta el pin si hace falta.</Notice>
              )}
              <button className={confirmed ? btnGhost : btnPrimary} onClick={() => setConfirmed(true)} disabled={confirmed || !insideMexico(location.lat, location.lng)}>
                <CheckCircle2 className="w-4 h-4" /> {confirmed ? 'Ubicación confirmada' : 'Sí, este es el punto correcto'}
              </button>
            </div>
          )}
        </section>

        {/* ── 2. CATEGORÍAS (INEGI) ── */}
        <section className={`${card} ${confirmed ? '' : 'opacity-50 pointer-events-none'}`}>
          <StepTitle n={2} title="¿Qué giros hay en la zona? (INEGI, gratis)" done={!!denueResult?.total}>
            <button className={btnPrimary} onClick={scanDenue} disabled={!confirmed || denueBusy}>
              {denueBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {denueResult ? 'Volver a escanear' : 'Escanear zona'}
            </button>
          </StepTitle>
          {denueError && <Notice kind="error">{denueError}</Notice>}
          {denueResult && denueResult.total > 0 && (
            <>
              <div className="text-sm mb-2">
                <b>{denueResult.total.toLocaleString('es-MX')}</b> negocios registrados en INEGI en {radiusKm} km, en <b>{denueResult.classes.length}</b> giros. Marca los que quieres descargar; en el mapa se pintan de naranja.
              </div>
              <input className={`${input} mb-2`} placeholder="Filtrar giros (ej. materiales, ferretería, taller)…" value={classFilter} onChange={e => setClassFilter(e.target.value)} />
              <div className="max-h-[360px] overflow-auto rounded-lg border border-[#2D1B4E]">
                <table className="w-full text-sm">
                  <thead className="bg-[#1E1635] text-[#C084FC] text-xs sticky top-0">
                    <tr><th className="p-2 w-8"></th><th className="p-2 text-left">#</th><th className="p-2 text-left">Giro (INEGI)</th><th className="p-2 text-right">Negocios</th><th className="p-2 text-right">%</th><th className="p-2 text-right hidden sm:table-cell">Con tel. en INEGI</th></tr>
                  </thead>
                  <tbody>
                    {visibleClasses.slice(0, 300).map(c => {
                      const on = picks.some(p => p.key === c.clase);
                      return (
                        <tr key={c.index} className={`border-t border-[#2D1B4E] cursor-pointer ${on ? 'bg-orange-500/10' : 'hover:bg-white/5'}`} onClick={() => togglePick(c)}>
                          <td className="p-2 text-center"><input type="checkbox" readOnly checked={on} /></td>
                          <td className="p-2 text-[#8B7AA8]">{c.rank}</td>
                          <td className="p-2">{c.clase}</td>
                          <td className="p-2 text-right font-semibold">{c.total.toLocaleString('es-MX')}</td>
                          <td className="p-2 text-right text-[#E9D5FF]/70">{c.pct.toFixed(1)}</td>
                          <td className="p-2 text-right text-[#E9D5FF]/70 hidden sm:table-cell">{c.conTelefono}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="mt-3 flex gap-2">
            <input className={input} placeholder="¿No aparece el giro? Escribe el término de Google Maps (ej. casa de materiales)" value={manualTerm}
              onChange={e => setManualTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManual()} />
            <button className={btnGhost} onClick={addManual}>Agregar</button>
          </div>
        </section>

        {/* ── 3. DESCARGA CON APIFY ── */}
        <section className={`${card} ${confirmed && picks.length ? '' : 'opacity-50 pointer-events-none'}`}>
          <StepTitle n={3} title="Descargar con Apify (Google Maps)" done={!!batch && !running && places.length > 0} />
          {picks.length > 0 && (
            <>
              <p className="text-xs text-[#8B7AA8] mb-2">
                El "término en Google" es lo que Apify va a buscar. Ajústalo si hace falta: así se llama el giro en Google, no en INEGI.
                "Registros a pedir" es el máximo; solo se cobra lo que de verdad encuentre.
              </p>
              <div className="space-y-2">
                {picks.map(p => (
                  <div key={p.key} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center bg-[#0A0713] border border-[#2D1B4E] rounded-lg p-2">
                    <div className="text-xs">
                      <div className="text-[#8B7AA8]">{p.denueIndex !== null ? 'Giro INEGI' : 'Término manual'}</div>
                      <div className="font-semibold">{p.key}</div>
                      {p.denueCount !== null && <div className="text-[#C084FC]">{p.denueCount} en INEGI</div>}
                    </div>
                    <label className="text-xs">
                      <span className="text-[#8B7AA8]">Término en Google</span>
                      <input className={input} value={p.term} onChange={e => updatePick(p.key, { term: e.target.value })} />
                    </label>
                    <label className="text-xs">
                      <span className="text-[#8B7AA8]">Registros a pedir</span>
                      <input className={`${input} w-28`} type="number" min={1} value={p.maxPlaces}
                        onChange={e => updatePick(p.key, { maxPlaces: Math.max(1, Number(e.target.value) || 1) })} />
                    </label>
                    <button className="text-xs text-red-300 hover:text-red-200 px-2" onClick={() => setPicks(prev => prev.filter(x => x.key !== p.key))}>Quitar</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="text-sm">
                  Necesitas hasta <b>{totalRequested.toLocaleString('es-MX')}</b> registros · costo máximo estimado <b>USD {estCost.toFixed(2)}</b>
                  <span className="text-xs text-[#8B7AA8]"> (≈ USD 4 por cada 1,000 en el plan gratuito de Apify)</span>
                </div>
                {!running ? (
                  <button className={btnPrimary} onClick={startRuns}><Play className="w-4 h-4" /> Correr Apify</button>
                ) : (
                  <button className={btnGhost} onClick={abortAll}><Square className="w-4 h-4" /> Detener</button>
                )}
              </div>
            </>
          )}
          {runError && <div className="mt-2"><Notice kind="error">{runError}</Notice></div>}
          {batch && (
            <div className="mt-3 space-y-1 text-sm">
              {batch.runs.map(r => (
                <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 bg-[#0A0713] border border-[#2D1B4E] rounded-lg px-3 py-2">
                  <span><b>{r.term}</b></span>
                  <span className="text-xs">
                    {r.status === 'ERROR' ? <span className="text-red-300">{r.error}</span> : (
                      <>
                        {!FINISHED.has(r.status) && <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />}
                        {r.status} · {r.itemCount} registros · USD {r.usd.toFixed(4)}
                      </>
                    )}
                  </span>
                </div>
              ))}
              <div className="text-xs text-[#8B7AA8]">Gasto real de esta descarga: USD {batchUsd.toFixed(4)}</div>
            </div>
          )}
        </section>

        {/* ── 4. RESULTADOS ── */}
        {(loadingItems || places.length > 0) && (
          <section className={card}>
            <StepTitle n={4} title="Revisar y bajar el Excel" done={false}>
              <button className={btnPrimary} onClick={exportExcel} disabled={!finalRows.length}>
                <Download className="w-4 h-4" /> Descargar Excel ({finalRows.length})
              </button>
            </StepTitle>
            {loadingItems && <Notice kind="info"><Loader2 className="w-4 h-4 inline animate-spin mr-1" />Bajando registros de Apify…</Notice>}
            {places.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
                  {[
                    ['Encontrados', enriched.length],
                    ['Dentro del radio', enriched.filter(p => p.inside).length],
                    ['Con teléfono', enriched.filter(p => p.phone).length],
                    ['En el Excel', finalRows.length],
                  ].map(([k, v]) => (
                    <div key={k as string} className="bg-[#0A0713] border border-[#2D1B4E] rounded-lg p-2">
                      <div className="text-xl font-bold">{v as number}</div>
                      <div className="text-[11px] text-[#8B7AA8]">{k}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-sm mb-3">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={onlyInside} onChange={e => setOnlyInside(e.target.checked)} /> Solo dentro del radio</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={skipClosed} onChange={e => setSkipClosed(e.target.checked)} /> Quitar cerrados</label>
                </div>
                <div className="text-xs text-[#8B7AA8] mb-1">Categorías que regresó Google. Desmarca las que no son del giro que buscas:</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {googleCats.map(([cat, n]) => {
                    const on = !excludedCats.has(cat);
                    return (
                      <button key={cat}
                        className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-[#2D1B4E] text-[#8B7AA8] line-through'}`}
                        onClick={() => setExcludedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; })}>
                        {cat} ({n})
                      </button>
                    );
                  })}
                </div>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-[#2D1B4E]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1E1635] text-[#C084FC] text-xs sticky top-0">
                      <tr><th className="p-2 text-left">Negocio</th><th className="p-2 text-left hidden md:table-cell">Categoría Google</th><th className="p-2 text-left">Teléfono</th><th className="p-2 text-right">km</th><th className="p-2 text-right hidden sm:table-cell">⭐</th></tr>
                    </thead>
                    <tbody>
                      {finalRows.slice(0, 200).map((p, i) => (
                        <tr key={p.placeId || i} className="border-t border-[#2D1B4E] align-top">
                          <td className="p-2">
                            <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-[#C084FC]">{p.title}</a>
                            <div className="text-[11px] text-[#8B7AA8]">{p.address}</div>
                          </td>
                          <td className="p-2 text-xs hidden md:table-cell">{p.categoryName}</td>
                          <td className="p-2 text-xs whitespace-nowrap">{p.phone || '—'}</td>
                          <td className="p-2 text-right text-xs">{p.distKm !== null ? p.distKm.toFixed(1) : '—'}</td>
                          <td className="p-2 text-right text-xs hidden sm:table-cell">{p.totalScore ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {finalRows.length > 200 && <div className="text-xs text-[#8B7AA8] mt-1">Se muestran 200; el Excel trae los {finalRows.length}.</div>}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
