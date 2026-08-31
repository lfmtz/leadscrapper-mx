"""
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
