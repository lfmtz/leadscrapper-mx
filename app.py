"""
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
from apify_service import obtener_token, estimar_costo, extraer_leads_apify, ApifyError
from data_processor import generate_filename, export_to_excel_buffer

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

    # ── EXTRAER LEADS REALES CON APIFY ───────
    st.markdown("### 📍 Extraer leads reales (dirección, teléfono y ubicación GPS)")
    token_apify = obtener_token()
    if not token_apify:
        st.warning(
            "Falta tu token de Apify. Agrégalo como `APIFY_TOKEN` en "
            "`.streamlit/secrets.toml` (local) o en *Settings → Secrets* de Streamlit Cloud."
        )
    elif cat_seleccionada:
        col_max, col_costo = st.columns([2, 1])
        with col_max:
            max_leads = st.number_input(
                "Máximo de negocios a extraer",
                min_value=10, max_value=2000, value=100, step=10,
                key="max_leads_apify"
            )
        with col_costo:
            st.metric("Costo máximo aprox.", f"USD {estimar_costo(max_leads):.2f}")

        if st.button(f"🚀 Extraer {cat_seleccionada} con Apify", type="primary",
                     use_container_width=True):
            estado_run = st.empty()
            try:
                with st.spinner("Extrayendo de Google Maps vía Apify..."):
                    leads = extraer_leads_apify(
                        cat_seleccionada, estado_busqueda, municipio_busqueda,
                        max_resultados=int(max_leads), token=token_apify,
                        progress_callback=lambda s, t: estado_run.caption(
                            f"Estado en Apify: {s} · {t}s"
                        ),
                    )
                st.session_state.leads_reales = leads
                st.session_state.leads_reales_cat = cat_seleccionada
            except ApifyError as e:
                st.error(f"❌ {e}")

    leads_reales = st.session_state.get("leads_reales")
    if leads_reales:
        st.success(
            f"✅ {len(leads_reales)} negocios reales de "
            f"{st.session_state.get('leads_reales_cat', '')}"
        )
        df_leads = pd.DataFrame(leads_reales)
        st.dataframe(
            df_leads[[
                "nombre_negocio", "categoria", "direccion_completa", "telefono",
                "calificacion", "num_resenas", "sitio_web", "link_navegacion"
            ]],
            use_container_width=True,
            hide_index=True,
            column_config={
                "link_navegacion": st.column_config.LinkColumn("Cómo llegar", display_text="🧭 Ir"),
                "sitio_web": st.column_config.LinkColumn("Sitio web"),
            },
        )
        nombre_arch = generate_filename(
            st.session_state.get("leads_reales_cat", ""), estado_busqueda, municipio_busqueda, "csv"
        )
        col_l1, col_l2 = st.columns(2)
        with col_l1:
            st.download_button(
                "📥 Descargar leads (.csv)",
                df_leads.to_csv(index=False).encode("utf-8-sig"),
                file_name=nombre_arch, mime="text/csv", use_container_width=True
            )
        with col_l2:
            st.download_button(
                "📊 Descargar leads (Excel)",
                export_to_excel_buffer(df_leads),
                file_name=nombre_arch.replace(".csv", ".xlsx"),
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )

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
        
        # Pines de los leads reales extraídos con Apify (coordenadas exactas)
        import html as _html
        for lead in st.session_state.get("leads_reales") or []:
            if lead.get("lat") is None or lead.get("lon") is None:
                continue
            popup = (
                f"<b>{_html.escape(lead['nombre_negocio'])}</b><br>"
                f"{_html.escape(lead['direccion_completa'])}<br>"
                f"📞 {_html.escape(str(lead['telefono']))}<br>"
                f"<a href='{_html.escape(lead['link_navegacion'])}' target='_blank'>🧭 Cómo llegar</a>"
            )
            folium.Marker(
                [lead["lat"], lead["lon"]],
                popup=folium.Popup(popup, max_width=280),
                icon=folium.Icon(color="green", icon="briefcase", prefix="fa"),
            ).add_to(m)

        st_folium(m, width=None, height=450)
    except Exception as e:
        st.info("💡 Instala folium y streamlit-folium para visualizar el mapa interactivo.")

st.markdown("---")
st.caption("LeadScrapper MX © 2026 - Diseñado para prospección comercial ética en México conforme a la LFPDPPP.")
