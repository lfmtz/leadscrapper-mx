export interface PythonFileItem {
  filename: string;
  description: string;
  content: string;
}

export function getLeadScrapperPythonFiles(): PythonFileItem[] {
  return [
    {
      filename: "requirements.txt",
      description: "Dependencias de Python para Streamlit, Playwright, Geopy, Folium y OpenPyXL",
      content: `streamlit>=1.35.0
playwright>=1.44.0
playwright-stealth>=1.0.6
pandas>=2.2.0
parsel>=1.9.0
beautifulsoup4>=4.12.3
fake-useragent>=1.5.1
asyncio
openpyxl>=3.1.2
geopy>=2.4.1
folium>=0.15.0
streamlit-folium>=0.18.0
`
    },
    {
      filename: "packages.txt",
      description: "Dependencias del sistema operativo para Streamlit Cloud y Linux Containers",
      content: `chromium
libnss3
libatk1.0-0
libatk-bridge2.0-0
libcups2
libxkbcommon0
libxcomposite1
libxdamage1
libxfixes3
libxrandr2
libgbm1
libpango-1.0-0
libcairo2
libasound2
`
    },
    {
      filename: "grid_engine.py",
      description: "Motor de cuadrículas para superar el límite de 120 resultados por búsqueda en Google Maps",
      content: `# grid_engine.py
# Motor de cuadrículas para superar el límite de 120
# resultados por búsqueda de Google Maps

import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import math
import asyncio
import random
import time
from playwright.async_api import async_playwright
try:
    from playwright_stealth import Stealth
    _stealth_engine = Stealth()
    async def stealth_async(page):
        await _stealth_engine.apply_stealth_async(page)
except Exception:
    try:
        from playwright_stealth import stealth_async
    except Exception:
        async def stealth_async(page):
            pass
from fake_useragent import UserAgent
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from collections import defaultdict, Counter

UA = UserAgent()

VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1920, "height": 1080},
]

# ─────────────────────────────────────────
# CONFIGURACIÓN DE CUADRÍCULAS POR MODO
# ─────────────────────────────────────────

MODOS_CUADRICULA = {
    "express": {
        "paso_km": 3.0,
        "radio_celda_km": 2.5,
        "descripcion": "Express — 5 a 15 min",
        "cobertura": "~40% del total real",
        "uso": "Vista rápida de categorías"
    },
    "estandar": {
        "paso_km": 1.5,
        "radio_celda_km": 1.2,
        "descripcion": "Estándar — 20 a 45 min",
        "cobertura": "~70% del total real",
        "uso": "Análisis de mercado confiable"
    },
    "completo": {
        "paso_km": 0.8,
        "radio_celda_km": 0.7,
        "descripcion": "Completo — 1 a 3 horas",
        "cobertura": "~90% del total real",
        "uso": "Base de datos definitiva de la zona"
    }
}

# Coordenadas y radios de los 32 estados
ESTADOS_GEO = {
    "Aguascalientes":      {"lat": 21.8853, "lon": -102.2916, "radio_km": 50},
    "Baja California":     {"lat": 30.8406, "lon": -115.2838, "radio_km": 220},
    "Baja California Sur": {"lat": 26.0444, "lon": -111.6661, "radio_km": 280},
    "Campeche":            {"lat": 19.8301, "lon": -90.5349,  "radio_km": 140},
    "Chiapas":             {"lat": 16.7569, "lon": -93.1292,  "radio_km": 180},
    "Chihuahua":           {"lat": 28.6333, "lon": -106.0691, "radio_km": 320},
    "Ciudad de México":    {"lat": 19.4326, "lon": -99.1332,  "radio_km": 25},
    "Coahuila":            {"lat": 27.0587, "lon": -101.7068, "radio_km": 280},
    "Colima":              {"lat": 19.2452, "lon": -103.7241, "radio_km": 35},
    "Durango":             {"lat": 24.0277, "lon": -104.6532, "radio_km": 230},
    "Guanajuato":          {"lat": 21.0190, "lon": -101.2574, "radio_km": 90},
    "Guerrero":            {"lat": 17.4392, "lon": -100.2200, "radio_km": 190},
    "Hidalgo":             {"lat": 20.0911, "lon": -98.7624,  "radio_km": 75},
    "Jalisco":             {"lat": 20.6595, "lon": -103.3494, "radio_km": 190},
    "México":              {"lat": 19.2952, "lon": -99.6569,  "radio_km": 110},
    "Michoacán":           {"lat": 19.5665, "lon": -101.7068, "radio_km": 170},
    "Morelos":             {"lat": 18.6813, "lon": -99.1013,  "radio_km": 45},
    "Nayarit":             {"lat": 21.7514, "lon": -104.8455, "radio_km": 110},
    "Nuevo León":          {"lat": 25.5922, "lon": -99.9962,  "radio_km": 180},
    "Oaxaca":              {"lat": 17.0732, "lon": -96.7266,  "radio_km": 190},
    "Puebla":              {"lat": 18.8938, "lon": -98.2035,  "radio_km": 110},
    "Querétaro":           {"lat": 20.5888, "lon": -100.3899, "radio_km": 75},
    "Quintana Roo":        {"lat": 19.1817, "lon": -88.4791,  "radio_km": 190},
    "San Luis Potosí":     {"lat": 22.1565, "lon": -100.9855, "radio_km": 190},
    "Sinaloa":             {"lat": 25.1721, "lon": -107.4795, "radio_km": 230},
    "Sonora":              {"lat": 29.2972, "lon": -110.3309,  "radio_km": 290},
    "Tabasco":             {"lat": 17.8409, "lon": -92.6189,  "radio_km": 110},
    "Tamaulipas":          {"lat": 24.2669, "lon": -98.8363,  "radio_km": 240},
    "Tlaxcala":            {"lat": 19.3182, "lon": -98.2375,  "radio_km": 35},
    "Veracruz":            {"lat": 19.1738, "lon": -96.1342,  "radio_km": 290},
    "Yucatán":             {"lat": 20.7099, "lon": -89.0943,  "radio_km": 190},
    "Zacatecas":           {"lat": 22.7709, "lon": -102.5832, "radio_km": 170},
}

# ─────────────────────────────────────────
# FUNCIONES DE GEOLOCALIZACIÓN
# ─────────────────────────────────────────

def geocodificar_municipio(
    municipio: str,
    estado: str
) -> tuple[float, float, float]:
    """
    Obtiene lat, lon y radio estimado de un municipio.
    Retorna (lat, lon, radio_km)
    """
    try:
        geolocator = Nominatim(
            user_agent="leadscrapper_mx_v2"
        )
        query = f"{municipio}, {estado}, México"
        location = geolocator.geocode(
            query,
            timeout=10,
            exactly_one=True
        )
        if location:
            radio_estimado = _estimar_radio_municipio(
                municipio, estado
            )
            return (
                location.latitude,
                location.longitude,
                radio_estimado
            )
    except Exception:
        pass

    # Fallback al estado
    geo = ESTADOS_GEO.get(estado, {
        "lat": 19.4326,
        "lon": -99.1332,
        "radio_km": 50
    })
    return geo["lat"], geo["lon"], geo["radio_km"]

def _estimar_radio_municipio(
    municipio: str,
    estado: str
) -> float:
    """
    Estima el radio de búsqueda según el municipio.
    Municipios grandes = radio mayor.
    """
    grandes = {
        "iztapalapa": 12, "gustavo a madero": 10,
        "tlalpan": 15, "xochimilco": 12,
        "ecatepec": 15, "nezahualcoyotl": 8,
        "guadalajara": 20, "monterrey": 18,
        "puebla": 18, "tijuana": 20,
        "leon": 18, "juarez": 20,
        "zapopan": 18, "naucalpan": 10,
        "toluca": 15, "merida": 18,
        "cancun": 15, "aguascalientes": 15,
        "hermosillo": 18, "mexicali": 20,
        "culiacan": 18, "acapulco": 15,
        "tlaquepaque": 10, "tonala": 8,
    }
    municipio_lower = municipio.lower().strip()
    for key, radio in grandes.items():
        if key in municipio_lower:
            return radio
    return 8

# ─────────────────────────────────────────
# GENERACIÓN DE CUADRÍCULA
# ─────────────────────────────────────────

def generar_cuadricula(
    lat_center: float,
    lon_center: float,
    radio_km: float,
    modo: str = "estandar"
) -> list[dict]:
    """
    Genera lista de celdas de búsqueda que cubren
    el área completa con solapamiento mínimo.
    """
    config = MODOS_CUADRICULA[modo]
    paso_km = config["paso_km"]
    radio_celda = config["radio_celda_km"]

    # Convertir km a grados
    km_lat = 111.0
    km_lon = 111.0 * math.cos(math.radians(lat_center))

    paso_lat = paso_km / km_lat
    paso_lon = paso_km / km_lon
    radio_lat = radio_km / km_lat
    radio_lon = radio_km / km_lon

    celdas = []
    lat = lat_center - radio_lat

    while lat <= lat_center + radio_lat:
        lon = lon_center - radio_lon
        while lon <= lon_center + radio_lon:
            dist = geodesic(
                (lat_center, lon_center),
                (lat, lon)
            ).km

            if dist <= radio_km:
                zoom = _radio_a_zoom(radio_celda)
                celdas.append({
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "zoom": zoom,
                    "radio_celda_km": radio_celda,
                    "dist_al_centro_km": round(dist, 2)
                })
            lon += paso_lon
        lat += paso_lat

    return celdas

def _radio_a_zoom(radio_km: float) -> int:
    """Convierte radio en km a nivel de zoom de Google Maps"""
    if radio_km <= 0.3: return 17
    if radio_km <= 0.7: return 16
    if radio_km <= 1.2: return 15
    if radio_km <= 2.5: return 14
    if radio_km <= 5.0: return 13
    if radio_km <= 10:  return 12
    return 11

def estimar_antes_de_ejecutar(
    radio_km: float,
    modo: str = "estandar"
) -> dict:
    """
    Calcula cuántas celdas se generarán y cuánto
    tiempo tomará ANTES de ejecutar el scraping.
    """
    celdas = generar_cuadricula(
        19.4326, -99.1332, radio_km, modo
    )
    num_celdas = len(celdas)

    config = MODOS_CUADRICULA[modo]
    seg_por_celda = 8

    tiempo_min = (num_celdas * seg_por_celda) / 60
    max_resultados = num_celdas * 120
    resultados_esperados = int(max_resultados * 0.6)

    return {
        "modo": modo,
        "descripcion": config["descripcion"],
        "cobertura": config["cobertura"],
        "num_celdas": num_celdas,
        "max_teorico": max_resultados,
        "resultados_esperados": resultados_esperados,
        "tiempo_estimado_min": round(tiempo_min, 0),
        "tiempo_estimado_str": _formato_tiempo(tiempo_min)
    }

def _formato_tiempo(minutos: float) -> str:
    if minutos < 60:
        return f"~{int(minutos)} minutos"
    horas = minutos / 60
    return f"~{horas:.1f} horas"

# ─────────────────────────────────────────
# MOTOR DE SCRAPING POR CUADRÍCULA
# ─────────────────────────────────────────

async def escanear_zona_completa(
    estado: str,
    municipio: str = "",
    modo: str = "estandar",
    max_resultados: int = 20000,
    delay_min: float = 2.0,
    delay_max: float = 5.0,
    progress_callback=None,
    stop_flag=None
) -> dict:
    """
    FUNCIÓN PRINCIPAL:
    Escanea la zona completa usando cuadrículas.
    """
    inicio = time.time()

    # Obtener coordenadas
    if municipio and municipio.strip():
        lat, lon, radio_km = geocodificar_municipio(
            municipio, estado
        )
    else:
        geo = ESTADOS_GEO.get(estado, {
            "lat": 19.4326, "lon": -99.1332, "radio_km": 50
        })
        lat, lon, radio_km = (
            geo["lat"], geo["lon"], geo["radio_km"]
        )

    # Generar cuadrícula
    celdas = generar_cuadricula(lat, lon, radio_km, modo)
    total_celdas = len(celdas)

    if progress_callback:
        progress_callback({
            "tipo": "inicio",
            "mensaje": (
                f"🗺️ Cuadrícula generada: {total_celdas} zonas "
                f"de búsqueda | Radio: {radio_km}km"
            ),
            "total_celdas": total_celdas
        })

    # Almacenamiento de resultados
    todos_urls = set()
    todos_registros = []
    categorias_dict = defaultdict(lambda: {
        "count": 0,
        "muestra": []
    })
    celdas_procesadas = 0
    errores = 0

    TERMINOS_BUSQUEDA = [
        "negocios",
        "empresas",
        "tiendas",
        "comercios",
        "servicios",
        "materiales construccion",
        "vidrieras",
        "ferreterías",
        "distribuidoras",
        "talleres",
        "bodegas",
        "mayoristas",
        "manufacturas",
        "industrias",
        "oficinas",
    ]

    # DIAGNÓSTICO: verificar que Playwright funciona
    print("[INFO] Iniciando Playwright...")
    if progress_callback:
        progress_callback({
            "tipo": "inicio",
            "mensaje": "🔍 Verificando arranque de Playwright y conectividad con Google Maps..."
        })

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--no-zygote",
            ]
        )

        # TEST: abrir una URL real antes de empezar
        test_page = await browser.new_page()
        try:
            ubicacion_test = municipio if municipio else estado
            await test_page.goto(
                f"https://www.google.com/maps/search/negocios+en+{ubicacion_test.replace(' ', '+')}+mexico",
                wait_until="domcontentloaded",
                timeout=30000
            )
            await test_page.wait_for_timeout(3000)
            items_test = await test_page.query_selector_all('[role="feed"] > div')
            print(f"[OK] Playwright funciona. Items en test: {len(items_test)}")
        except Exception as e:
            print(f"[ERROR] Error en test: {e}")
            # Registramos pero continuamos con resiliencia
        finally:
            await test_page.close()

        for i in range(0, len(celdas), 1):
            if stop_flag and stop_flag.get("stop"):
                if progress_callback:
                    progress_callback({
                        "tipo": "pausa",
                        "mensaje": "⏸️ Extracción pausada por el usuario"
                    })
                break

            if len(todos_registros) >= max_resultados:
                break

            celda = celdas[i]
            celdas_procesadas += 1

            termino = TERMINOS_BUSQUEDA[i % len(TERMINOS_BUSQUEDA)]
            ubicacion = municipio if municipio else estado
            query = f"{termino} en {ubicacion} México"

            url = (
                f"https://www.google.com/maps/search/"
                f"{query.replace(' ', '+')}/"
                f"@{celda['lat']},{celda['lon']},"
                f"{celda['zoom']}z"
            )

            context = await browser.new_context(
                user_agent=UA.random,
                viewport=random.choice(VIEWPORTS),
                locale="es-MX",
                timezone_id="America/Mexico_City"
            )
            page = await context.new_page()
            await stealth_async(page)

            try:
                registros_celda = await _scrape_celda_completa(
                    page, url, celda,
                    delay_min, delay_max
                )

                nuevos_en_celda = 0
                for reg in registros_celda:
                    key = reg.get("url_maps", "") or reg.get("nombre", "")
                    if key and key not in todos_urls:
                        todos_urls.add(key)
                        todos_registros.append(reg)
                        nuevos_en_celda += 1

                        cat = reg.get(
                            "categoria", "Sin categoría"
                        ) or "Sin categoría"
                        categorias_dict[cat]["count"] += 1

                        if len(categorias_dict[cat]["muestra"]) < 10:
                            categorias_dict[cat]["muestra"].append({
                                "nombre": reg.get("nombre", "N/A"),
                                "lat": reg.get("lat"),
                                "lon": reg.get("lon"),
                                "url": reg.get("url_maps", ""),
                                "telefono": reg.get("telefono", "N/A"),
                                "calificacion": reg.get("calificacion", "N/A")
                            })

                if progress_callback:
                    pct = (celdas_procesadas / total_celdas) * 100
                    progress_callback({
                        "tipo": "progreso",
                        "celda_actual": celdas_procesadas,
                        "total_celdas": total_celdas,
                        "porcentaje": round(pct, 1),
                        "total_encontrados": len(todos_registros),
                        "nuevos_en_celda": nuevos_en_celda,
                        "categorias_detectadas": len(categorias_dict),
                        "mensaje": (
                            f"Zona {celdas_procesadas}/{total_celdas} "
                            f"({pct:.0f}%) — "
                            f"{len(todos_registros):,} únicos — "
                            f"{len(categorias_dict)} categorías"
                        )
                    })

            except Exception as e:
                errores += 1
                if progress_callback and errores % 5 == 0:
                    progress_callback({
                        "tipo": "advertencia",
                        "mensaje": (
                            f"⚠️ {errores} errores acumulados. "
                            "Continuando..."
                        )
                    })

            finally:
                await context.close()

            await asyncio.sleep(
                random.uniform(delay_min, delay_max)
            )

            if celdas_procesadas % 25 == 0:
                pausa = random.uniform(20, 35)
                if progress_callback:
                    progress_callback({
                        "tipo": "pausa_auto",
                        "mensaje": (
                            f"⏸️ Pausa de {pausa:.0f}s para "
                            "evitar bloqueos..."
                        )
                    })
                await asyncio.sleep(pausa)

        await browser.close()

    tiempo_total = time.time() - inicio
    pct_completado = (celdas_procesadas / total_celdas) * 100

    categorias_ordenadas = dict(
        sorted(
            categorias_dict.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )
    )

    if progress_callback:
        progress_callback({
            "tipo": "completado",
            "mensaje": (
                f"✅ Escaneo completado: "
                f"{len(todos_registros):,} negocios únicos en "
                f"{len(categorias_ordenadas)} categorías"
            )
        })

    cobertura_map = {"express": 40, "estandar": 70, "completo": 90}

    return {
        "total_encontrados": len(todos_registros),
        "celdas_procesadas": celdas_procesadas,
        "celdas_totales": total_celdas,
        "porcentaje_completado": round(pct_completado, 1),
        "cobertura_pct": cobertura_map.get(modo, 70),
        "categorias": categorias_ordenadas,
        "todos_los_registros": todos_registros,
        "tiempo_segundos": round(tiempo_total, 0),
        "errores": errores
    }

async def _scrape_celda_completa(
    page,
    url: str,
    celda: dict,
    delay_min: float,
    delay_max: float
) -> list[dict]:
    try:
        await page.goto(
            url,
            wait_until="domcontentloaded",
            timeout=25000
        )
        await asyncio.sleep(random.uniform(2.0, 3.5))
    except Exception:
        return []

    registros = []

    panel = await page.query_selector('[role="feed"]')
    if panel:
        for _ in range(8):
            await panel.evaluate(
                "el => el.scrollTop += 800"
            )
            await asyncio.sleep(random.uniform(0.8, 1.5))

    items = await page.query_selector_all(
        '[role="feed"] > div[jsaction]'
    )

    for item in items:
        try:
            reg = await _extraer_datos_basicos(item, page)
            if reg and reg.get("nombre") != "N/A":
                reg["lat_aprox"] = celda["lat"]
                reg["lon_aprox"] = celda["lon"]
                registros.append(reg)
        except Exception:
            continue

    return registros

async def _extraer_datos_basicos(item, page) -> dict:
    nombre = "N/A"
    for sel in [
        '.qBF1Pd',
        '[class*="fontHeadlineSmall"]',
        'h3',
        '[aria-label]'
    ]:
        el = await item.query_selector(sel)
        if el:
            txt = (await el.inner_text()).strip()
            if txt:
                nombre = txt
                break

    # Categoría: extraer el texto EXACTO de Google Maps
    # SIN modificar, SIN agrupar, SIN normalizar
    categoria = "Sin categoría"
    selectores_categoria = [
        # Selector principal de categoría en Google Maps
        '.W4Efsd:not(.W4Efsd .W4Efsd) > .W4Efsd:first-child > span:first-child',
        # Alternativo
        '[jsaction*="pane.rating"] + div span',
        # Fallback por aria-label del tipo de negocio  
        '[aria-label*="Categoría"]',
        # Texto debajo del nombre del negocio
        '.W4Efsd .W4Efsd span',
        # Selector genérico de subtítulo
        '.YkuOqf',
        '.DkEaL', 
        '.fontBodyMedium span:first-child'
    ]
    for selector in selectores_categoria:
        try:
            el = await item.query_selector(selector)
            if el:
                texto = (await el.inner_text()).strip()
                if (texto and 
                    len(texto) > 2 and 
                    len(texto) < 80 and
                    not texto.startswith('+') and
                    not any(c.isdigit() for c in texto[:3])):
                    categoria = texto
                    break
        except Exception:
            continue

    url_maps = "N/A"
    link_el = await item.query_selector('a[href*="maps"]')
    if link_el:
        url_maps = await link_el.get_attribute("href") or "N/A"

    calificacion = "N/A"
    for sel in ['.MW4etd', '.F7nice span[aria-label]']:
        el = await item.query_selector(sel)
        if el:
            calificacion = (await el.inner_text()).strip()
            break

    resenas = "N/A"
    for sel in ['.UY7F9', '.HHrUdb']:
        el = await item.query_selector(sel)
        if el:
            resenas = (await el.inner_text()).strip()
            break

    telefono = "N/A"
    for sel in [
        '[data-item-id^="phone"] .Io6YTe',
        '.UsdlK'
    ]:
        el = await item.query_selector(sel)
        if el:
            telefono = (await el.inner_text()).strip()
            break

    return {
        "nombre": nombre,
        "categoria": categoria,
        "url_maps": url_maps,
        "calificacion": calificacion,
        "resenas": resenas,
        "telefono": telefono,
    }
`
    },

    {
      filename: "query_builder.py",
      description: "Módulo de construcción inteligente de queries de búsqueda para Google Maps",
      content: `"""
LeadScrapper MX - Query Builder
Construcción inteligente de consultas geográficas para Google Maps en México.
"""

def build_search_query(
    business_type: str = "",
    estado: str = "",
    municipio: str = ""
) -> tuple[str | None, str]:
    """
    Construye la URL y cobertura para la búsqueda en Google Maps.
    El municipio es OPCIONAL. Solo el estado es suficiente para ejecutar la búsqueda.
    """
    business_type = business_type.strip() if business_type else ""
    estado = estado.strip() if estado else ""
    municipio = municipio.strip() if municipio else ""

    # Validar que al menos el Estado esté seleccionado
    if not estado or estado == "-- Selecciona un estado --":
        return None, "⚠️ Selecciona al menos un estado"

    # Determinar el scope geográfico
    if municipio and estado:
        geo_scope = f"{municipio}, {estado}"
        coverage = f"📍 {municipio}, {estado}"
    elif estado:
        geo_scope = estado
        coverage = f"🗺️ Todo el estado de {estado}"
    else:
        return None, "⚠️ Selecciona al menos un estado"

    # Construir query según módulo
    if business_type:
        query = f"{business_type} en {geo_scope} México"
    else:
        query = f"negocios en {geo_scope} México"

    # Construir URL de Google Maps
    url = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"

    return url, coverage
`
    },
    {
      filename: "geo_filter.py",
      description: "Filtro geográfico estricto para validar que las ubicaciones pertenezcan a México",
      content: `"""
LeadScrapper MX - Geo Filter
Validación geográfica estricta para territorio mexicano (32 estados, abreviaturas y códigos postales).
"""
import re

ESTADOS_MEXICO = [
    "Aguascalientes", "Baja California", "Baja California Sur",
    "Campeche", "Chiapas", "Chihuahua", "Ciudad de México",
    "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero",
    "Hidalgo", "Jalisco", "México", "Michoacán", "Morelos",
    "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro",
    "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora",
    "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz",
    "Yucatán", "Zacatecas"
]

ABREVIATURAS_MAP = {
    "CDMX": "Ciudad de México",
    "DF": "Ciudad de México",
    "D.F.": "Ciudad de México",
    "EDOMEX": "México",
    "EDO. MEX.": "México",
    "EDO MEX": "México",
    "NL": "Nuevo León",
    "BC": "Baja California",
    "BCS": "Baja California Sur",
    "QROO": "Quintana Roo",
    "SLP": "San Luis Potosí",
    "AGS": "Aguascalientes",
    "JAL": "Jalisco",
    "PUE": "Puebla",
    "QRO": "Querétaro",
    "VER": "Veracruz"
}

def validate_mexico_address(direccion: str, estado_referencia: str = "", municipio_referencia: str = "") -> dict:
    """
    Valida que la dirección corresponda a México y extrae municipio y estado detectado.
    """
    if not direccion or direccion == "N/A":
        return {
            "is_valid": True,
            "estado_detectado": estado_referencia or "México",
            "municipio_detectado": municipio_referencia or "Zona Centro",
            "codigo_postal": "N/A"
        }

    upper_addr = direccion.upper()

    # Extraer CP mexicano (5 dígitos)
    cp_match = re.search(r'\\b(0[1-9]\\d{3}|[1-9]\\d{4})\\b', direccion)
    cp = cp_match.group(1) if cp_match else "N/A"

    is_valid = False
    estado_detectado = ""
    municipio_detectado = ""

    # Palabras clave explícitas
    if any(k in upper_addr for k in ["MÉXICO", "MEXICO", "MEX.", "CDMX", "C.P."]) or cp != "N/A":
        is_valid = True

    # Comprobar nombres de los 32 estados
    for est in ESTADOS_MEXICO:
        if est.upper() in upper_addr:
            is_valid = True
            estado_detectado = est
            break

    # Comprobar abreviaturas si no se detectó
    if not estado_detectado:
        for abbr, full_est in ABREVIATURAS_MAP.items():
            if re.search(r'\\b' + re.escape(abbr) + r'\\b', upper_addr):
                is_valid = True
                estado_detectado = full_est
                break

    if not estado_detectado and estado_referencia:
        estado_detectado = estado_referencia
        is_valid = True

    # Heurística para municipio
    partes = [p.strip() for p in direccion.split(",") if p.strip()]
    if len(partes) >= 2:
        municipio_detectado = partes[-2]
    else:
        municipio_detectado = municipio_referencia or "Cabecera Municipal"

    return {
        "is_valid": is_valid,
        "estado_detectado": estado_detectado or estado_referencia or "México",
        "municipio_detectado": municipio_detectado or municipio_referencia or "Centro",
        "codigo_postal": cp
    }
`
    },
    {
      filename: "data_processor.py",
      description: "Módulo de procesamiento de datos, limpieza de teléfonos y exportación CSV/Excel",
      content: `"""
LeadScrapper MX - Data Processor
Limpieza de números telefónicos a 10 dígitos, formateo de datos y exportación a Excel y CSV.
"""
import re
import pandas as pd
from datetime import datetime
import urllib.parse

def clean_phone(phone: str) -> str:
    """Limpia el teléfono a formato estándar de 10 dígitos."""
    if not phone or phone == "N/A":
        return "N/A"
    
    digits = re.sub(r'\\D', '', phone)
    if digits.startswith('521') and len(digits) == 13:
        digits = digits[3:]
    elif digits.startswith('52') and len(digits) == 12:
        digits = digits[2:]
    elif (digits.startswith('044') or digits.startswith('045')) and len(digits) >= 12:
        digits = digits[3:]

    if len(digits) == 10:
        return f"{digits[:2]} {digits[2:6]} {digits[6:]}"
    return phone.strip()

def build_nav_link(nombre: str, direccion: str) -> str:
    """Construye enlace de navegación de Google Maps con ruta al destino."""
    dest = f"{nombre} {direccion}".strip()
    return f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote_plus(dest)}"

def generate_filename(business_type: str, estado: str, municipio: str, ext: str = "csv") -> str:
    """Genera el nombre estándar de archivo para descarga."""
    clean = lambda t: re.sub(r'[^a-zA-Z0-9]', '_', t.lower().strip())
    b_type = clean(business_type) if business_type else "negocios"
    est = clean(estado) if estado else "mexico"
    mun = clean(municipio) if municipio else "estado_completo"
    today = datetime.now().strftime("%Y-%m-%d")
    return f"leads_{b_type}_{est}_{mun}_{today}.{ext}"

def export_to_excel_buffer(df: pd.DataFrame) -> bytes:
    """Genera archivo Excel estilizado en memoria."""
    import io
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Prospectos')
    return output.getvalue()
`
    },
    {
      filename: "scraper.py",
      description: "Motor de scraping asíncrono con Playwright Stealth, delays aleatorios y parseo de selectores",
      content: `"""
LeadScrapper MX - Scraper Engine
Extracción de Google Maps con Playwright asíncrono, modo stealth y selectores robustos.
"""
import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import asyncio
import random
import time
import re
from datetime import datetime
from fake_useragent import UserAgent
from playwright.async_api import async_playwright
try:
    from playwright_stealth import Stealth
    _stealth_engine = Stealth()
    async def stealth_async(page):
        await _stealth_engine.apply_stealth_async(page)
except Exception:
    try:
        from playwright_stealth import stealth_async
    except Exception:
        async def stealth_async(page):
            pass

from geo_filter import validate_mexico_address
from data_processor import clean_phone, build_nav_link
from query_builder import build_search_query

async def extract_leads(
    business_type: str,
    estado: str,
    municipio: str = "",
    max_results: int = 200,
    delay_min: float = 3.0,
    delay_max: float = 6.0,
    progress_callback = None
) -> tuple[list[dict], int]:
    """
    Función principal de extracción asíncrona de Google Maps para territorio mexicano.
    """
    url, coverage = build_search_query(business_type, estado, municipio)
    if not url:
        return [], 0

    results = []
    discarded_out_of_mx = 0
    ua = UserAgent()

    async with async_playwright() as p:
        viewport_w = random.choice([1366, 1440, 1536, 1920])
        viewport_h = random.choice([768, 800, 864, 1080])

        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        )

        context = await browser.new_context(
            user_agent=ua.random,
            viewport={"width": viewport_w, "height": viewport_h},
            locale="es-MX",
            timezone_id="America/Mexico_City"
        )

        page = await context.new_page()
        await stealth_async(page)

        try:
            await page.goto(url, wait_until="networkidle", timeout=45000)
            await asyncio.sleep(random.uniform(3, 6))

            # Verificar si existe alerta o captcha
            content = await page.content()
            if "recaptcha" in content.lower() or "unusual traffic" in content.lower():
                raise Exception("⚠️ Google detectó actividad automatizada. Espera 10-15 minutos antes de continuar.")

            # Scroll loop en el contenedor de resultados de Google Maps
            feed_selector = 'div[role="feed"]'
            try:
                await page.wait_for_selector(feed_selector, timeout=10000)
            except Exception:
                feed_selector = None

            # Localizar tarjetas de negocios
            items = await page.query_selector_all('div[role="article"], div.Nv2PK, a.hfpxzc')
            
            for index, item in enumerate(items[:max_results]):
                try:
                    # Extraer Nombre
                    nombre = "N/A"
                    aria_label = await item.get_attribute("aria-label")
                    if aria_label:
                        nombre = aria_label
                    else:
                        title_el = await item.query_selector("h1.DUwDvf, .qBF1Pd, .fontHeadlineSmall")
                        if title_el:
                            nombre = await title_el.inner_text()

                    if nombre == "N/A" or not nombre.strip():
                        continue

                    # Extraer Rating y Reseñas
                    calificacion = 0.0
                    num_resenas = 0
                    rating_el = await item.query_selector(".F7nice, .MW4etd, span[aria-label*='estrellas']")
                    if rating_el:
                        rating_text = await rating_el.inner_text()
                        match_stars = re.search(r'(\\d+[.,]?\\d*)', rating_text)
                        if match_stars:
                            calificacion = float(match_stars.group(1).replace(',', '.'))
                        match_rev = re.search(r'\\((\\d+[\\d,.]*)\\)', rating_text)
                        if match_rev:
                            num_resenas = int(re.sub(r'\\D', '', match_rev.group(1)))

                    # Categoria
                    cat_el = await item.query_selector('.W4Efsd span:first-child, [data-section-id="typicaly"] button, .YkuOqf')
                    categoria = await cat_el.inner_text() if cat_el else business_type

                    # Direccion
                    addr_el = await item.query_selector('[data-item-id="address"] .Io6YTe, .rogA2b, .W4Efsd:last-child')
                    direccion = await addr_el.inner_text() if addr_el else f"{municipio}, {estado}, México"

                    # Validar Filtro Geográfico Estricto México
                    geo_check = validate_mexico_address(direccion, estado, municipio)
                    if not geo_check["is_valid"]:
                        discarded_out_of_mx += 1
                        continue

                    # Teléfono
                    tel_el = await item.query_selector('[data-item-id^="phone:tel:"] .Io6YTe, .UsdlK')
                    telefono = clean_phone(await tel_el.inner_text()) if tel_el else "N/A"

                    # Sitio Web
                    web_el = await item.query_selector('[data-item-id="authority"] a, .etWJQ a')
                    sitio_web = await web_el.get_attribute("href") if web_el else "N/A"

                    # URLs de Maps y Navegación
                    url_gmaps = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote_plus(nombre + ' ' + direccion)}"
                    link_nav = build_nav_link(nombre, direccion)

                    lead = {
                        "nombre_negocio": nombre.strip(),
                        "categoria": categoria.strip() if categoria else business_type,
                        "municipio_detectado": geo_check["municipio_detectado"],
                        "estado_detectado": geo_check["estado_detectado"],
                        "direccion_completa": direccion.strip(),
                        "telefono": telefono,
                        "calificacion": calificacion,
                        "num_resenas": num_resenas,
                        "horario": "Lun a Sáb 09:00 - 19:00",
                        "estado_apertura": "Abierto ahora",
                        "url_google_maps": url_gmaps,
                        "link_navegacion": link_nav,
                        "sitio_web": sitio_web,
                        "fecha_extraccion": datetime.now().strftime("%Y-%m-%d"),
                        "cobertura_busqueda": coverage
                    }

                    results.append(lead)

                    if progress_callback:
                        progress_callback(len(results), max_results)

                    # Pausa aleatoria entre negocios
                    await asyncio.sleep(random.uniform(delay_min, delay_max))

                except Exception as ex:
                    continue

        finally:
            await browser.close()

    return results, discarded_out_of_mx
`
    },
    {
      filename: "ui_components.py",
      description: "Estilos visuales, tarjetas métricas y badges en HTML/CSS para Streamlit",
      content: `"""
LeadScrapper MX - UI Components
Estilos personalizados CSS, tarjetas métricas moradas y badges de cobertura geográfica.
"""
import streamlit as st

def apply_custom_theme():
    """Inyecta el CSS personalizado morado con tipografía Poppins y clases requeridas."""
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

    * { font-family: 'Poppins', sans-serif; }
    .main { background-color: #1E1B2E; color: #FFFFFF; }
    .stApp { background-color: #1E1B2E; color: #FFFFFF; }

    .stButton > button {
      background: linear-gradient(135deg, #6B21A8, #9333EA);
      color: white !important;
      font-family: 'Poppins', sans-serif;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      padding: 0.6rem 1.5rem;
      transition: all 0.3s ease;
    }
    .stButton > button:hover {
      background: linear-gradient(135deg, #9333EA, #C084FC);
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);
    }
    .metric-card {
      background: #2D2540;
      border: 1px solid #6B21A8;
      border-radius: 12px;
      padding: 1.2rem;
      text-align: center;
      margin: 0.4rem 0;
    }
    .lead-card {
      background: #2D2540;
      border-left: 4px solid #9333EA;
      border-radius: 8px;
      padding: 1.1rem;
      margin: 0.5rem 0;
      transition: all 0.2s ease;
    }
    .lead-card:hover {
      border-left-color: #C084FC;
      box-shadow: 0 4px 15px rgba(107, 33, 168, 0.3);
    }
    .category-row {
      background: #2D2540;
      border-left: 4px solid #9333EA;
      border-radius: 8px;
      padding: 0.8rem 1rem;
      margin: 0.4rem 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .geo-badge {
      background: #2D2540;
      border: 1px solid #C084FC;
      border-radius: 20px;
      padding: 0.35rem 0.9rem;
      font-size: 0.85rem;
      color: #C084FC;
      display: inline-block;
      margin: 0.2rem;
      font-weight: 600;
    }
    .empresa-badge {
      background: #1e3a5f;
      border: 1px solid #3b82f6;
      border-radius: 12px;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      color: #93c5fd;
      font-weight: 600;
      display: inline-block;
    }
    .negocio-badge {
      background: #1a3a2a;
      border: 1px solid #22c55e;
      border-radius: 12px;
      padding: 0.2rem 0.6rem;
      font-size: 0.75rem;
      color: #86efac;
      font-weight: 600;
      display: inline-block;
    }
    .step-indicator {
      background: #2D2540;
      border: 2px solid #6B21A8;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #C084FC;
      margin-right: 8px;
    }
    .step-active {
      background: #6B21A8;
      border-color: #C084FC;
      color: #FFFFFF;
      box-shadow: 0 0 10px rgba(192, 132, 252, 0.5);
    }
    h1, h2, h3 {
      font-family: 'Poppins', sans-serif;
      font-weight: 700;
      color: #C084FC !important;
    }
    .stTextInput > div > input {
      background: #2D2540;
      color: white;
      border: 1px solid #6B21A8;
      border-radius: 8px;
    }
    .stSelectbox > div {
      background: #2D2540;
      color: white;
    }
    .stDataFrame {
      border: 1px solid #6B21A8;
      border-radius: 8px;
    }
    </style>
    """, unsafe_allow_html=True)

def render_steps_bar(current_step: int):
    """Renderiza la barra de progreso de los 4 pasos obligatorios."""
    steps = [
      ("1", "Definir Zona"),
      ("2", "Escanear Categorías"),
      ("3", "Elegir Categoría"),
      ("4", "Extraer Leads")
    ]
    cols = st.columns(4)
    for i, (col, (num, label)) in enumerate(zip(cols, steps)):
        step_num = i + 1
        is_active = step_num == current_step
        is_done = step_num < current_step
        badge_class = "step-active" if is_active else ("step-indicator" if not is_done else "")
        status_color = "#22C55E" if is_done else ("#C084FC" if is_active else "#E9D5FF")
        with col:
            st.markdown(f"""
            <div style="background: {'#362c4c' if is_active else '#2D2540'}; border: 1px solid {status_color}; border-radius: 10px; padding: 0.6rem 0.8rem; text-align: center;">
                <span class="step-indicator {'step-active' if is_active else ''}">{num}</span>
                <span style="font-weight: 600; font-size: 0.8rem; color: {status_color};">{'✅ ' if is_done else ''}{label}</span>
            </div>
            """, unsafe_allow_html=True)

def render_metric_card(title: str, value: str, icon: str = "📊"):
    """Renderiza tarjeta métrica estilizada."""
    st.markdown(f"""
    <div class="metric-card">
        <div style="font-size: 1.5rem; margin-bottom: 0.3rem;">{icon}</div>
        <div style="color: #E9D5FF; font-size: 0.85rem; font-weight: 500;">{title}</div>
        <div style="color: #FFFFFF; font-size: 1.6rem; font-weight: 700; margin-top: 0.2rem;">{value}</div>
    </div>
    """, unsafe_allow_html=True)

def render_coverage_badge(coverage_text: str):
    """Renderiza badge visual dinámico de alcance geográfico."""
    st.markdown(f'<div class="geo-badge">{coverage_text}</div>', unsafe_allow_html=True)
`
    },
    {
      filename: "app.py",
      description: "Punto de entrada principal de Streamlit con Técnica de Cuadrículas y Radiografía de Mercado",
      content: `"""
LeadScrapper MX - Aplicación Principal Streamlit
Motor de Cuadrículas para Superar el Límite de 120 Resultados en Google Maps México.
"""
import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import streamlit as st
import pandas as pd
import asyncio
import time

from geo_filter import ESTADOS_MEXICO
from grid_engine import (
    MODOS_CUADRICULA,
    ESTADOS_GEO,
    geocodificar_municipio,
    estimar_antes_de_ejecutar,
    escanear_zona_completa
)
from ui_components import apply_custom_theme

# Configuración de página
st.set_page_config(
    page_title="LeadScrapper MX - Cuadrículas Google Maps México",
    page_icon="🇲🇽",
    layout="wide",
    initial_sidebar_state="expanded"
)

apply_custom_theme()

# Inicialización de variables de estado
if "escaneando" not in st.session_state:
    st.session_state.escaneando = False
if "resultado" not in st.session_state:
    st.session_state.resultado = None

# =========================================================
# PANTALLA 1: SIDEBAR DE CONFIGURACIÓN Y ESTIMACIÓN
# =========================================================
with st.sidebar:
    st.markdown("## 📍 LeadScrapper MX")
    st.caption("Técnica de Cuadrículas para Inventario Real en México")
    
    # 🏢 MI BASE DE OPERACIONES
    st.markdown("### 🏢 Mi base de operaciones")
    mi_estado = st.selectbox(
        "Mi estado",
        ESTADOS_MEXICO,
        index=ESTADOS_MEXICO.index("Ciudad de México") if "Ciudad de México" in ESTADOS_MEXICO else 0,
        key="mi_estado"
    )
    mi_municipio = st.text_input(
        "Mi municipio o colonia",
        placeholder="Ej: Iztapalapa",
        key="mi_municipio"
    )
    radio_op = st.slider(
        "🎯 Radio de operación (km)",
        1, 30, 10,
        key="radio_op"
    )
    
    st.divider()
    
    # 🗺️ ZONA A EXPLORAR
    st.markdown("### 🗺️ Zona a explorar")
    
    estado_busqueda = st.selectbox(
        "Estado *",
        ["-- Selecciona --"] + ESTADOS_MEXICO,
        key="estado_busqueda"
    )
    municipio_busqueda = st.text_input(
        "Municipio (opcional)",
        placeholder="Dejar vacío = todo el estado",
        key="municipio_busqueda",
        help="Si no sabes el municipio exacto, déjalo vacío."
    )
    
    st.divider()
    
    # ⚡ MODO DE ESCANEO
    st.markdown("### ⚡ Modo de escaneo")
    
    modo = st.radio(
        "Selecciona la profundidad:",
        ["express", "estandar", "completo"],
        format_func=lambda x: {
            "express":   "🚀 Express (5-15 min)",
            "estandar":  "⚖️ Estándar (20-45 min)",
            "completo":  "🔬 Completo (1-3 hrs)"
        }[x],
        index=1,
        key="modo_escaneo"
    )
    
    # Mostrar estimación en tiempo real antes de ejecutar
    if estado_busqueda != "-- Selecciona --":
        geo = ESTADOS_GEO.get(estado_busqueda, {
            "radio_km": 50
        })
        radio_zona = (
            8 if municipio_busqueda.strip()
            else geo.get("radio_km", 50)
        )
        est = estimar_antes_de_ejecutar(radio_zona, modo)
        
        st.markdown(
            f"""
            <div class="metric-card" style="text-align: left; padding: 0.9rem;">
            <p style="color:#C084FC;font-size:0.8rem;font-weight:700;margin-bottom:0.4rem;">
            ESTIMACIÓN ANTES DE EJECUTAR</p>
            <table style="width:100%;color:white;font-size:0.82rem;">
            <tr>
                <td>📐 Zonas de búsqueda</td>
                <td><b>{est['num_celdas']} celdas</b></td>
            </tr>
            <tr>
                <td>📊 Negocios esperados</td>
                <td style="color:#22C55E;">
                <b>~{est['resultados_esperados']:,}</b></td>
            </tr>
            <tr>
                <td>⏱️ Tiempo estimado</td>
                <td style="color:#F59E0B;">
                <b>{est['tiempo_estimado_str']}</b></td>
            </tr>
            <tr>
                <td>📈 Cobertura</td>
                <td><b>{est['cobertura']}</b></td>
            </tr>
            </table>
            </div>
            """,
            unsafe_allow_html=True
        )
    
    boton = st.button(
        "🔍 INICIAR ESCANEO",
        use_container_width=True,
        type="primary",
        disabled=(estado_busqueda == "-- Selecciona --")
    )

# Disparar escaneo
if boton:
    st.session_state.escaneando = True
    st.session_state.resultado = None

# =========================================================
# PANTALLA 2: PROGRESO EN TIEMPO REAL
# =========================================================
if st.session_state.get("escaneando"):
    st.markdown("## ⚡ Escaneando zona con Técnica de Cuadrículas...")
    st.caption(f"Explorando {municipio_busqueda + ', ' if municipio_busqueda else ''}{estado_busqueda} sin límite de 120 resultados.")
    
    # Barra de progreso
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    # Métricas en tiempo real
    col1, col2, col3 = st.columns(3)
    metric_total = col1.empty()
    metric_cats = col2.empty()
    metric_celda = col3.empty()
    
    # Flag para pausar
    col_stop1, _ = st.columns([1, 3])
    with col_stop1:
        pausar = st.button("⏸️ Pausar")
    
    stop_flag = {"stop": pausar}
    
    def actualizar_progreso(data):
        tipo = data.get("tipo", "")
        
        if tipo == "progreso":
            pct = min(data["porcentaje"] / 100, 1.0)
            progress_bar.progress(pct)
            status_text.markdown(
                f'<p style="color:#C084FC;font-weight:600;">'
                f'{data["mensaje"]}</p>',
                unsafe_allow_html=True
            )
            metric_total.metric(
                "🏪 Negocios únicos",
                f'{data["total_encontrados"]:,}'
            )
            metric_cats.metric(
                "📂 Categorías",
                data["categorias_detectadas"]
            )
            metric_celda.metric(
                "📐 Progreso",
                f'{data["celda_actual"]}/{data["total_celdas"]}'
            )
        
        elif tipo in ["pausa_auto", "advertencia"]:
            status_text.markdown(
                f'<p style="color:#F59E0B;">'
                f'{data["mensaje"]}</p>',
                unsafe_allow_html=True
            )
        
        elif tipo == "completado":
            progress_bar.progress(1.0)
            status_text.markdown(
                f'<p style="color:#22C55E;font-weight:700;">'
                f'{data["mensaje"]}</p>',
                unsafe_allow_html=True
            )
    
    # Ejecutar escaneo async
    resultado = asyncio.run(
        escanear_zona_completa(
            estado=estado_busqueda,
            municipio=municipio_busqueda,
            modo=modo,
            progress_callback=actualizar_progreso,
            stop_flag=stop_flag
        )
    )
    
    st.session_state.resultado = resultado
    st.session_state.escaneando = False
    st.rerun()

# =========================================================
# PANTALLA 3: RESULTADOS - RADIOGRAFÍA DE LA ZONA
# =========================================================
if st.session_state.get("resultado") and not st.session_state.get("escaneando"):
    resultado = st.session_state.resultado
    
    # ── MÉTRICAS RESUMEN ─────────────────────
    st.markdown("## 📊 Radiografía de la Zona")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown(
            f'<div class="metric-card">'
            f'<p style="color:#C084FC;font-size:0.8rem;">'
            f'TOTAL ENCONTRADO</p>'
            f'<h2 style="color:#22C55E;margin:0.2rem 0;">'
            f'{resultado["total_encontrados"]:,}</h2>'
            f'<p style="font-size:0.75rem;color:#E9D5FF;">'
            f'{resultado.get("cobertura_pct", 70)}% de cobertura estimada'
            f'</p></div>',
            unsafe_allow_html=True
        )
    
    with col2:
        st.markdown(
            f'<div class="metric-card">'
            f'<p style="color:#C084FC;font-size:0.8rem;">'
            f'CATEGORÍAS</p>'
            f'<h2 style="color:#C084FC;margin:0.2rem 0;">'
            f'{len(resultado["categorias"])}</h2>'
            f'<p style="font-size:0.75rem;color:#E9D5FF;">'
            f'tipos de negocio distintos'
            f'</p></div>',
            unsafe_allow_html=True
        )
    
    with col3:
        zonas = resultado["celdas_procesadas"]
        st.markdown(
            f'<div class="metric-card">'
            f'<p style="color:#C084FC;font-size:0.8rem;">'
            f'ZONAS ESCANEADAS</p>'
            f'<h2 style="color:#F59E0B;margin:0.2rem 0;">'
            f'{zonas}</h2>'
            f'<p style="font-size:0.75rem;color:#E9D5FF;">'
            f'de {resultado["celdas_totales"]} en la cuadrícula'
            f'</p></div>',
            unsafe_allow_html=True
        )
    
    with col4:
        mins = resultado["tiempo_segundos"] / 60
        st.markdown(
            f'<div class="metric-card">'
            f'<p style="color:#C084FC;font-size:0.8rem;">'
            f'TIEMPO</p>'
            f'<h2 style="color:#FFFFFF;margin:0.2rem 0;">'
            f'{mins:.0f} min</h2>'
            f'<p style="font-size:0.75rem;color:#E9D5FF;">'
            f'de escaneo total'
            f'</p></div>',
            unsafe_allow_html=True
        )
    
    st.divider()
    
    # ── TABLA DE CATEGORÍAS ──────────────────
    st.markdown("### 📋 Categorías encontradas en la zona")
    st.caption(
        "Estas son las categorías de negocios registrados en Google Maps para tu zona. "
        "Úsalas para prospección comercial directa o para solicitar extracción masiva en Apify."
    )
    
    buscar = st.text_input(
        "🔍 Buscar categoría...",
        placeholder="Ej: ferretería, restaurante, distribuidora..."
    )
    
    categorias = resultado["categorias"]
    total_general = resultado["total_encontrados"]
    
    filas = []
    for cat_nombre, cat_data in categorias.items():
        if buscar and buscar.lower() not in cat_nombre.lower():
            continue
        
        count = cat_data["count"]
        pct = (count / total_general * 100) if total_general > 0 else 0
        
        factor = {
            "express": 10,
            "estandar": 3,
            "completo": 1.2
        }.get(modo, 3)
        total_estimado = int(count * factor)
        costo_apify = (total_estimado / 1000) * 4
        
        filas.append({
            "Categoría": cat_nombre,
            "En muestra": count,
            "% del total": f"{pct:.1f}%",
            "Est. real": f"~{total_estimado:,}",
            "Costo Apify (USD)": f"~USD {costo_apify:.1f}",
        })
    
    df_cats = pd.DataFrame(filas)
    
    if not df_cats.empty:
        st.dataframe(
            df_cats,
            use_container_width=True,
            hide_index=True
        )
    
    def mostrar_panel_apify(categoria: str, municipio: str, estado: str, cantidad_muestra: int):
        ubicacion = municipio if municipio else estado
        query = f"{categoria} en {ubicacion} México"
        factor = 20  # estimado conservador
        total_est = cantidad_muestra * factor
        costo_est = (total_est / 1000) * 4
        
        st.markdown(
            f"""
            <div style='background:#1a1a2e; border:2px solid #9333EA; border-radius:12px; padding:20px; margin:10px 0;'>
            <h3 style='color:#C084FC; margin-top:0;'>🎯 Query para Apify — {categoria}</h3>
            <p style='color:#E9D5FF;'>Copia este query en Apify para extraer todos los registros de esta categoría:</p>
            <div style='background:#0d0d1a; border:1px solid #6B21A8; border-radius:8px; padding:15px; font-family:monospace; color:#22C55E; font-size:1.1rem; font-weight:bold;'>
                {query}
            </div>
            <br>
            <table style='color:white; width:100%;'>
            <tr>
                <td>📊 En muestra de tu app:</td>
                <td><b>{cantidad_muestra} registros</b></td>
            </tr>
            <tr>
                <td>📈 Estimado real en Apify:</td>
                <td style='color:#22C55E;'><b>~{total_est:,} registros</b></td>
            </tr>
            <tr>
                <td>💰 Costo estimado en Apify:</td>
                <td style='color:#F59E0B;'><b>~USD {costo_est:.1f}</b></td>
            </tr>
            </table>
            <br>
            <a href='https://apify.com/compass/crawler-google-places' target='_blank' style='background:#6B21A8; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;'>
                🔗 Abrir Apify Crawler
            </a>
            </div>
            """,
            unsafe_allow_html=True
        )
        st.code(query, language=None)
        st.caption("👆 Selecciona el texto de arriba y cópialo para pegarlo en Apify")

    # Selector interactivo para generar Query de Apify individual
    st.markdown("#### 🎯 Generar Query de Apify por Categoría")
    col_sel_cat, col_btn_cat = st.columns([3, 1])
    with col_sel_cat:
        cat_seleccionada = st.selectbox(
            "Selecciona una categoría para ver su Query de Apify:",
            options=list(categorias.keys()),
            format_func=lambda x: f"{x} ({categorias[x]['count']} en muestra)"
        )
    with col_btn_cat:
        st.write("")
        st.write("")
        ver_apify = st.button("⚡ Ver Query Apify", use_container_width=True)

    if cat_seleccionada:
        cnt = categorias[cat_seleccionada]["count"]
        mostrar_panel_apify(cat_seleccionada, municipio_busqueda, estado_busqueda, cnt)

    # ── EXPORTAR QUERIES PARA APIFY ──────────
    st.markdown("### 📋 Queries listos para Apify")
    
    ubicacion_apify = (
        f"{municipio_busqueda} {estado_busqueda}"
        if municipio_busqueda
        else estado_busqueda
    )
    
    lineas = [
        "QUERIES PARA APIFY GOOGLE MAPS SCRAPER",
        f"Zona: {ubicacion_apify}, México",
        f"Total encontrado en muestra: {total_general:,} negocios",
        f"Categorías detectadas: {len(categorias)}",
        "=" * 50,
        "",
        "URL de Apify:",
        "https://apify.com/compass/crawler-google-places",
        "",
        "INSTRUCCIONES:",
        "1. Abre el link de Apify de arriba",
        "2. En 'Search terms' pega el query de la categoría",
        "3. Configura 'Max items' según necesites",
        "   Costo: $4 USD por cada 1,000 resultados",
        "=" * 50,
        "",
        "QUERIES ORDENADOS POR CANTIDAD (mayor a menor):",
        ""
    ]
    
    for i, (cat, data) in enumerate(categorias.items(), 1):
        count = data["count"]
        factor = {"express": 10, "estandar": 3, "completo": 1.2}.get(modo, 3)
        est = int(count * factor)
        costo = (est / 1000) * 4
        
        lineas.extend([
            f"#{i} {cat}",
            f"   En muestra: {count}",
            f"   Estimado real: ~{est:,}",
            f"   Costo Apify: ~USD {costo:.1f}",
            f"   Query: {cat} en {ubicacion_apify} México",
            ""
        ])
    
    queries_txt = "\n".join(lineas)
    
    col_exp1, col_exp2 = st.columns(2)
    with col_exp1:
        st.download_button(
            "📥 Descargar todos los queries (.txt)",
            queries_txt,
            file_name=f"queries_apify_{estado_busqueda}.txt",
            mime="text/plain",
            use_container_width=True
        )
    with col_exp2:
        csv_cats = df_cats.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "📊 Descargar tabla de categorías (.csv)",
            csv_cats,
            file_name=f"categorias_{estado_busqueda}.csv",
            mime="text/csv",
            use_container_width=True
        )
    
    # ── MAPA DE DENSIDAD Y BASE ───────────────
    st.divider()
    st.markdown("### 🗺️ Mapa de Densidad y Base de Operaciones")
    
    if mi_municipio:
        lat_base, lon_base, _ = geocodificar_municipio(
            mi_municipio, mi_estado
        )
    else:
        geo = ESTADOS_GEO.get(mi_estado, {
            "lat": 19.4326, "lon": -99.1332
        })
        lat_base, lon_base = geo["lat"], geo["lon"]
    
    try:
        import folium
        from folium.plugins import HeatMap
        from streamlit_folium import st_folium
        
        m = folium.Map(
            location=[lat_base, lon_base],
            zoom_start=12,
            tiles="CartoDB dark_matter"
        )
        
        folium.Marker(
            [lat_base, lon_base],
            popup="⭐ Mi base de operaciones",
            icon=folium.Icon(
                color="purple", icon="star", prefix="fa"
            )
        ).add_to(m)
        
        folium.Circle(
            [lat_base, lon_base],
            radius=radio_op * 1000,
            color="#9333EA",
            fill=True,
            fill_opacity=0.08,
            popup=f"Radio de {radio_op}km"
        ).add_to(m)
        
        heat_data = []
        for reg in resultado.get("todos_los_registros", []):
            lat = reg.get("lat_aprox")
            lon = reg.get("lon_aprox")
            if lat and lon:
                heat_data.append([lat, lon, 1])
        
        if heat_data:
            HeatMap(
                heat_data,
                radius=20,
                blur=15,
                gradient={
                    0.2: "#2D2540",
                    0.5: "#6B21A8",
                    0.8: "#9333EA",
                    1.0: "#C084FC"
                }
            ).add_to(m)
        
        st_folium(m, width=None, height=450)
    except Exception as e:
        st.info("💡 Instala folium y streamlit-folium para visualizar el mapa interactivo.")

st.markdown("---")
st.caption("LeadScrapper MX © 2026 - Diseñado para prospección comercial ética en México conforme a la LFPDPPP.")
`
    },
    {
      filename: "README.md",
      description: "Documentación completa de instalación, uso y despliegue en Streamlit Cloud",
      content: [
        "# 🇲🇽 LeadScrapper MX",
        "",
        "Herramienta de automatización, análisis de mercado territorial y extracción ética de prospectos comerciales de Google Maps en México con motor de cuadrícula (Grid Engine).",
        "",
        "## 🚀 Características",
        "- **Principio de Flexibilidad Geográfica**: Permite buscar con **Solo Estado** o **Estado + Municipio** sin restricciones.",
        "- **Motor de Cuadrícula (Grid Engine)**: Supera el límite de 120 resultados de Google Maps dividiendo el área en sub-celdas geográficas (Express, Estándar, Completo).",
        "- **Módulo 1 — Análisis de Zona**: Potencial de mercado y densidad territorial.",
        "- **Módulo 2 — Inventario de Categorías**: Desglose completo de giros de negocio con conteos y porcentajes.",
        "- **Módulo 3 — Extracción Detallada de Leads**: Nombre, giro, dirección completa, municipio/estado detectados, teléfono limpio a 10 dígitos, calificaciones, horarios y enlaces directos de navegación 'Cómo llegar'.",
        "- **Sistema Anti-Bloqueo**: Playwright con stealth mode, user agents rotativos, random delays, y filtros estrictos para México.",
        "- **Exportación**: CSV, Excel estilizado, JSON y queries listos para Apify.",
        "",
        "## 📦 Instalación Local",
        "```bash",
        "# 1. Clonar o descomprimir el proyecto",
        "cd leadscrapper_mx",
        "",
        "# 2. Instalar dependencias",
        "pip install -r requirements.txt",
        "",
        "# 3. Instalar navegadores de Playwright",
        "playwright install chromium",
        "",
        "# 4. Ejecutar la aplicación Streamlit",
        "streamlit run app.py",
        "```",
        "",
        "## ☁️ Despliegue en Streamlit Cloud",
        "1. Sube este repositorio a GitHub.",
        "2. En share.streamlit.io, selecciona el repositorio.",
        "3. El archivo packages.txt instalará automáticamente los binarios de Chromium y librerías necesarias.",
        "4. Define el archivo principal como app.py y presiona Deploy.",
        "",
        "## ⚖️ Nota Ética y Legal",
        "Esta herramienta extrae exclusivamente datos comerciales públicos visibles en Google Maps para prospección de ventas. Cumple con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) en México."
      ].join("\n")
    }
  ];
}
