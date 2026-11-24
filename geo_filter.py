"""
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
    cp_match = re.search(r'\b(0[1-9]\d{3}|[1-9]\d{4})\b', direccion)
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
            if re.search(r'\b' + re.escape(abbr) + r'\b', upper_addr):
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
