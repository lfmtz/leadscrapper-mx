"""
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
