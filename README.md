# 🗺️ LeadScrapper MX
### Inteligencia Comercial para México — con datos reales

> **Importante:** la versión anterior de esta app mostraba negocios, teléfonos y conteos **inventados**
> (generados en `src/services/scraperEngine.ts`). La pantalla principal ahora usa solo datos reales:
>
> - **INEGI DENUE** (gratis): qué giros hay en la zona, cuántos negocios y dónde están (mapa de densidad).
> - **Google Maps vía Apify** (de pago, ≈ USD 4 por cada 1,000 registros): teléfono, calificación, reseñas y sitio web.
>
> La versión simulada sigue disponible en `?demo=1`, solo como referencia.

## Flujo

1. **Conexión:** prueba el token de Apify bajando 1 registro real.
2. **Ubicación:** GPS de tu equipo, dirección, coordenadas o enlace de Google Maps. Confirmas el punto en el mapa
   (el pin se puede arrastrar). Radio de 0.5 a 5 km.
3. **Giros (INEGI):** ranking de giros por número de negocios en el radio. Marcas los que te interesan.
4. **Apify:** cada giro se traduce a su término de Google (editable). La app te dice cuántos registros pedir y el costo máximo.
5. **Excel:** filtras por categoría de Google, distancia y negocios cerrados, y descargas el `.xlsx` (con enlace de WhatsApp).

## Configuración en Netlify

1. Conecta este repositorio en Netlify (la configuración de build ya está en `netlify.toml`).
2. En **Site configuration → Environment variables**, crea:

| Variable | Valor |
|---|---|
| `APIFY_TOKEN` | Token de tu cuenta de Apify (console.apify.com → Settings → API & Integrations) |
| `INEGI_TOKEN` | Token del DENUE de INEGI |
| `APP_ACCESS_CODE` | Un código que tú inventas; la app lo pide para que nadie más gaste tus créditos |
| `MAX_PLACES_PER_RUN` | (Opcional) Máximo de registros por término, 1000 por defecto |

3. Vuelve a publicar el sitio (**Deploys → Trigger deploy**) para que tome las variables.

Los tokens solo viven en las funciones de servidor (`netlify/functions/apify.mts` y `denue.mts`), nunca en el navegador.

### Probar en tu computadora

```bash
npm install
npm install -g netlify-cli
netlify dev
```

(Con un archivo `.env` basado en `.env.example`.)

---

## Versión anterior (Python / Streamlit)


---

## 📌 ¿Qué hace esta app?

**LeadScrapper MX** es una herramienta de prospección territorial y análisis de mercado diseñada específicamente para la República Mexicana. Supera el límite estándar de 120 resultados de Google Maps mediante un motor de subdivisión en cuadrículas geodésicas:

1. **📍 Escanea zonas de México usando cuadrículas**: Divide cualquier municipio, alcaldía o estado en celdas de alta resolución con solapamiento geográfico calibrado (15%–20%).
2. **🏷️ Muestra todas las categorías de negocios que existen en esa zona**: Captura las categorías reales y auténticas de Google Maps (vidrierías, casas de materiales, tlapalerías, talleres, distribuidoras) sin agruparlas forzosamente en términos genéricos.
3. **🎯 Genera los queries exactos para extraer los datos completos en Apify**: Proporciona los términos optimizados listos para copiar y pegar en `compass/crawler-google-places` con estimación automática de volumen y costo en USD.

---

## 🚀 Instalación local (paso a paso)

Sigue estos pasos en tu terminal para ejecutar **LeadScrapper MX** localmente:

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/leadscrapper-mx
cd leadscrapper-mx
```

### Paso 2: Instalar dependencias Python
```bash
pip install -r requirements.txt
```

### Paso 3: Instalar el navegador de Playwright
```bash
playwright install chromium
```

### Paso 4: Correr la app
```bash
streamlit run app.py
```

### Paso 5: Abrir en el navegador
La aplicación se abrirá automáticamente en tu navegador web predeterminado en:
```text
http://localhost:8501
```

---

## ☁️ Deploy en Streamlit Cloud (gratis)

Puedes publicar la aplicación en la nube de forma 100% gratuita siguiendo estos pasos:

1. Crea o inicia sesión en tu cuenta de [GitHub](https://github.com).
2. Crea un repositorio nuevo con el nombre: `leadscrapper-mx`.
3. Sube todos los archivos del proyecto a la rama principal (`main`).
4. Ingresa a [share.streamlit.io](https://share.streamlit.io).
5. Inicia sesión con tu cuenta de GitHub.
6. Haz clic en el botón **"New app"**.
7. Selecciona el repositorio: `leadscrapper-mx`.
8. En **Main file path**, ingresa: `app.py`.
9. Haz clic en **"Deploy"**.
10. En 3 a 5 minutos tu app estará en línea con enlace público seguro (HTTPS).

---

## 📁 Estructura de archivos

El proyecto está diseñado bajo una arquitectura modular limpia y desacoplada:

```text
leadscrapper-mx/
├── app.py              → Interfaz principal Streamlit y visualización
├── grid_engine.py      → Motor de cuadrículas y scraping con Playwright
├── geo_filter.py       → Validación geográfica estricta para México
├── data_processor.py   → Limpieza y normalización de teléfonos a 10 dígitos
├── query_builder.py    → Generador de queries y estimador de costos para Apify
├── requirements.txt    → Dependencias del entorno Python
├── packages.txt        → Dependencias del sistema operativo (Linux/Debian)
└── README.md           → Documentación oficial del proyecto
```

---

## ⚙️ Cómo funciona

El proceso de prospección sigue un flujo lineal de 4 pasos continuos:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  1. 📍 Define    │  ──►  │  2. 🗺️ Divide   │  ──►  │  3. 🔍 Escanea   │  ──►  │  4. 📋 Resultados│
│   tu zona       │       │   en celdas     │       │   cada celda    │       │   y Query Apify │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **📍 Defines tu zona**: Seleccionas el Estado, Municipio o Alcaldía, Radio en kilómetros y Base de Operaciones del equipo comercial.
2. **🗺️ La app divide la zona en celdas pequeñas**: El motor matemático proyecta una malla de coordenadas con solapamiento uniforme.
3. **🔍 Escanea cada celda en Google Maps**: Ejecuta Playwright en modo Stealth rotando entre 15 términos de búsqueda específicos para capturar giros industriales, comerciales y de servicios.
4. **📋 Te muestra las categorías + query para Apify**: Presenta la radiografía de mercado, el mapa interactivo de cuadrículas y el botón de generación de query para extracción masiva.

---

## 💡 Modos de escaneo

Puedes elegir la resolución de prospección según tus necesidades de tiempo y profundidad:

| Modo | Tiempo | Cobertura | Uso recomendado |
| :--- | :--- | :--- | :--- |
| **⚡ Express** | 5–15 min | ~40% | Ver categorías rápido y validar viabilidad de la zona |
| **🎯 Estándar** | 20–45 min | ~70% | Análisis de mercado formal y prospección equilibrada |
| **🔬 Completo** | 1–3 hrs | ~90% | Base de datos definitiva y cobertura comercial exhaustiva |

---

## 🔗 Integración con Apify

LeadScrapper MX se integra de manera óptima con Apify para la extracción masiva:

1. **Generación del Query**: La app genera automáticamente la sintaxis precisa por categoría (ejemplo: `Vidriería en Iztacalco Ciudad de México México`).
2. **Pega el Query**: Ingresa a [apify.com/compass/crawler-google-places](https://apify.com/compass/crawler-google-places) y pega el query en la sección *Search terms*.
3. **Extracción Masiva**: Apify extrae miles de registros completos (sitio web, horarios, teléfonos, reseñas y coordenadas).

> 💰 **Costo de referencia en Apify**: ~$4 USD por cada 1,000 resultados extraídos.

---

## 🛠️ Agregar nuevas funciones

El código está estructurado en módulos independientes para facilitar su extensión y mantenimiento:

- **Para cambiar la interfaz de usuario**: Edita `app.py` (componentes Streamlit, filtros, botones y métricas).
- **Para cambiar cómo se escanea o agregar selectores**: Edita `grid_engine.py` (lógica de Playwright, rotación de términos y cálculo de cuadrículas).
- **Para cambiar los filtros o la base geográfica de México**: Edita `geo_filter.py` (códigos postales, estados y validación territorial).
- **Para cambiar cómo se procesan o exportan los datos**: Edita `data_processor.py` (formato de teléfono a 10 dígitos, CSV y enlaces de navegación).
- **Para ajustar la sintaxis de exportación para Apify**: Edita `query_builder.py` (fórmulas de estimación y construcción de queries).

---

## 📋 Requisitos del sistema

- **Python**: Versión 3.9 o superior.
- **Navegador**: Google Chrome o Chromium instalado (gestionado por Playwright).
- **Conexión**: Conexión a internet estable.
- **Memoria RAM**: Mínimo 4 GB recomendados para la ejecución concurrente de Playwright.

---

## ⚠️ Nota importante

> Esta herramienta extrae datos de carácter público disponibles en Google Maps (nombre del establecimiento, teléfono comercial, dirección y giro de negocios). El usuario final es el único responsable del uso ético y legal de la información recopilada, debiendo actuar en estricto apego a la legislación mexicana aplicable, incluyendo la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**.

---

## 📞 Soporte y mejoras

Para expandir capacidades, adaptar nuevas fuentes de datos o implementar mejoras personalizadas, utiliza **Google AI Studio** cargando el contexto completo del repositorio.
