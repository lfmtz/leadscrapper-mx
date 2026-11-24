"""
LeadScrapper MX - Apify Service
Extracción de leads REALES (dirección, teléfono, coordenadas) usando el actor
compass/crawler-google-places de Apify.

El token se lee de st.secrets["APIFY_TOKEN"] o de la variable de entorno
APIFY_TOKEN. Nunca lo escribas en el código.
"""
import json
import os
import time
import urllib.parse
import urllib.request

ACTOR_ID = "compass~crawler-google-places"
API_BASE = "https://api.apify.com/v2"
COSTO_USD_POR_1000 = 4.0


class ApifyError(Exception):
    pass


def obtener_token() -> str:
    """Busca el token en Streamlit secrets y luego en variables de entorno."""
    try:
        import streamlit as st
        tok = st.secrets.get("APIFY_TOKEN", "")
        if tok:
            return str(tok).strip()
    except Exception:
        pass
    return os.environ.get("APIFY_TOKEN", "").strip()


def _request(method: str, path: str, token: str, body: dict | None = None,
             params: dict | None = None, timeout: int = 60):
    url = f"{API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detalle = e.read().decode("utf-8", errors="replace")[:300]
        if e.code in (401, 403):
            raise ApifyError("Token de Apify inválido o sin permisos.") from e
        if e.code == 402:
            raise ApifyError("La cuenta de Apify no tiene saldo suficiente.") from e
        raise ApifyError(f"Error de Apify ({e.code}): {detalle}") from e
    except urllib.error.URLError as e:
        raise ApifyError(f"No se pudo conectar con Apify: {e.reason}") from e


def verificar_cuenta(token: str) -> dict:
    """Devuelve usuario y plan de la cuenta de Apify (sirve para validar el token)."""
    data = _request("GET", "/users/me", token).get("data", {})
    return {
        "usuario": data.get("username"),
        "plan": (data.get("plan") or {}).get("id"),
    }


def estimar_costo(max_resultados: int) -> float:
    return round(max_resultados / 1000 * COSTO_USD_POR_1000, 2)


def construir_input(categoria: str, estado: str, municipio: str = "",
                    max_resultados: int = 100) -> dict:
    """Input del actor: busca la categoría dentro de la zona indicada."""
    ubicacion = ", ".join(p for p in [municipio.strip(), estado.strip(), "México"] if p)
    return {
        "searchStringsArray": [categoria.strip()],
        "locationQuery": ubicacion,
        "maxCrawledPlacesPerSearch": int(max_resultados),
        "language": "es",
        "countryCode": "mx",
        "skipClosedPlaces": True,
        "scrapePlaceDetailPage": False,
        "scrapeContacts": False,
        "maxImages": 0,
        "maxReviews": 0,
    }


def _horario_texto(opening_hours) -> str:
    if not opening_hours:
        return "N/A"
    try:
        return " | ".join(f"{h.get('day')}: {h.get('hours')}" for h in opening_hours)
    except Exception:
        return "N/A"


def normalizar_lugar(item: dict, cobertura: str) -> dict:
    """Convierte un resultado de Apify al formato de lead de la app."""
    from data_processor import clean_phone

    nombre = item.get("title") or "N/A"
    loc = item.get("location") or {}
    lat, lng = loc.get("lat"), loc.get("lng")
    direccion = item.get("address") or ", ".join(
        p for p in [item.get("street"), item.get("neighborhood"), item.get("postalCode"),
                    item.get("city"), item.get("state")] if p
    ) or "N/A"

    place_id = item.get("placeId")
    if lat is not None and lng is not None:
        destino = f"{lat},{lng}"
        nav = f"https://www.google.com/maps/dir/?api=1&destination={destino}"
        if place_id:
            nav += f"&destination_place_id={place_id}"
    else:
        nav = "https://www.google.com/maps/dir/?api=1&destination=" + \
              urllib.parse.quote_plus(f"{nombre} {direccion}")

    return {
        "nombre_negocio": nombre,
        "categoria": item.get("categoryName") or "N/A",
        "direccion_completa": direccion,
        "colonia": item.get("neighborhood") or "N/A",
        "codigo_postal": item.get("postalCode") or "N/A",
        "municipio_detectado": item.get("city") or "N/A",
        "estado_detectado": item.get("state") or "N/A",
        "telefono": clean_phone(item.get("phone") or "N/A"),
        "sitio_web": item.get("website") or "N/A",
        "calificacion": item.get("totalScore") or 0,
        "num_resenas": item.get("reviewsCount") or 0,
        "horario": _horario_texto(item.get("openingHours")),
        "cerrado_permanente": bool(item.get("permanentlyClosed")),
        "lat": lat,
        "lon": lng,
        "url_google_maps": item.get("url") or "N/A",
        "place_id": place_id,
        "link_navegacion": nav,
        "fecha_extraccion": time.strftime("%Y-%m-%d"),
        "cobertura_busqueda": cobertura,
    }


def extraer_leads_apify(categoria: str, estado: str, municipio: str = "",
                        max_resultados: int = 100, token: str | None = None,
                        progress_callback=None, timeout_seg: int = 900) -> list[dict]:
    """
    Corre el actor de Google Maps en Apify y devuelve leads con direcciones reales.
    """
    token = token or obtener_token()
    if not token:
        raise ApifyError("Falta APIFY_TOKEN. Agrégalo en .streamlit/secrets.toml o como variable de entorno.")

    run_input = construir_input(categoria, estado, municipio, max_resultados)
    run = _request("POST", f"/acts/{ACTOR_ID}/runs", token, body=run_input).get("data", {})
    run_id = run.get("id")
    if not run_id:
        raise ApifyError("Apify no devolvió el ID de la ejecución.")

    inicio = time.time()
    status = run.get("status")
    while status in ("READY", "RUNNING"):
        if time.time() - inicio > timeout_seg:
            raise ApifyError("La extracción en Apify tardó demasiado. Revisa la ejecución en console.apify.com.")
        time.sleep(5)
        run = _request("GET", f"/actor-runs/{run_id}", token).get("data", {})
        status = run.get("status")
        if progress_callback:
            progress_callback(status, int(time.time() - inicio))

    if status != "SUCCEEDED":
        raise ApifyError(f"La ejecución en Apify terminó con estado {status}.")

    dataset_id = run.get("defaultDatasetId")
    items = _request("GET", f"/datasets/{dataset_id}/items", token,
                     params={"clean": "true", "format": "json"}, timeout=120)

    cobertura = ", ".join(p for p in [municipio.strip(), estado.strip()] if p)
    leads, vistos = [], set()
    for it in items:
        clave = it.get("placeId") or (it.get("title"), it.get("address"))
        if clave in vistos:
            continue
        vistos.add(clave)
        leads.append(normalizar_lugar(it, cobertura))
    return leads


# ─────────────────────────────────────────
# PUNTO DE PARTIDA (ubicación física del trabajo)
# ─────────────────────────────────────────

# Punto de partida por defecto: ubicación física del trabajo.
# Coordenadas tomadas de Google Maps. Se puede cambiar con BASE_DIRECCION en secrets.
BASE_DEFAULT = {
    "nombre": "Mi trabajo",
    "direccion": "Calz. Ignacio Zaragoza 957-A, Agrícola Oriental, Iztacalco, 08500 Ciudad de México, CDMX",
    "lat": 19.4037044,
    "lon": -99.069271,
}


def obtener_base_config() -> dict:
    """Lee la base de operaciones de st.secrets / variables de entorno."""
    def _get(clave):
        try:
            import streamlit as st
            v = st.secrets.get(clave, "")
            if v:
                return str(v).strip()
        except Exception:
            pass
        return os.environ.get(clave, "").strip()
    return {
        "nombre": _get("BASE_NOMBRE") or BASE_DEFAULT["nombre"],
        "direccion": _get("BASE_DIRECCION") or BASE_DEFAULT["direccion"],
    }


def _parse_coordenadas(texto: str):
    """Acepta '19.3911, -99.1071' (copiado de Google Maps)."""
    import re
    m = re.match(r"^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$", texto or "")
    if m:
        return float(m.group(1)), float(m.group(2))
    return None


def geocodificar_direccion(direccion: str):
    """Devuelve (lat, lon, direccion_encontrada) o None."""
    if (direccion or "").strip().lower() == BASE_DEFAULT["direccion"].lower():
        return BASE_DEFAULT["lat"], BASE_DEFAULT["lon"], BASE_DEFAULT["direccion"]
    coords = _parse_coordenadas(direccion)
    if coords:
        return coords[0], coords[1], direccion.strip()
    if not direccion or not direccion.strip():
        return None
    try:
        from geopy.geocoders import Nominatim
        geo = Nominatim(user_agent="leadscrapper_mx_v2")
        consulta = direccion if "méxico" in direccion.lower() else f"{direccion}, México"
        loc = geo.geocode(consulta, timeout=10, exactly_one=True, country_codes="mx")
        if loc:
            return loc.latitude, loc.longitude, loc.address
    except Exception:
        pass
    return None


def distancia_km(lat1, lon1, lat2, lon2) -> float:
    """Distancia en línea recta (Haversine)."""
    from math import radians, sin, cos, asin, sqrt
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(a))


def aplicar_punto_de_partida(leads: list[dict], lat_base: float, lon_base: float) -> list[dict]:
    """
    Calcula la distancia desde el trabajo, arma la ruta con ORIGEN en el trabajo
    y ordena los leads del más cercano al más lejano.
    """
    origen = f"{lat_base},{lon_base}"
    for lead in leads:
        lat, lon = lead.get("lat"), lead.get("lon")
        if lat is None or lon is None:
            lead["distancia_km"] = None
            continue
        lead["distancia_km"] = round(distancia_km(lat_base, lon_base, lat, lon), 1)
        ruta = (
            "https://www.google.com/maps/dir/?api=1"
            f"&origin={origen}&destination={lat},{lon}&travelmode=driving"
        )
        if lead.get("place_id"):
            ruta += f"&destination_place_id={lead['place_id']}"
        lead["link_navegacion"] = ruta
    return sorted(leads, key=lambda l: (l.get("distancia_km") is None, l.get("distancia_km") or 0))
