# grid_engine.py
# Motor de cuadrículas para superar el límite de 120
# resultados por búsqueda de Google Maps

import math
import asyncio
import random
import time
from dataclasses import dataclass
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
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
    print("🔍 Iniciando Playwright...")
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
            print(f"✅ Playwright funciona. Items en test: {len(items_test)}")
        except Exception as e:
            print(f"❌ Error en test: {e}")
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
