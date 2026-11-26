import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import RealProspector from './real/RealProspector.tsx';
import './index.css';

// La pantalla principal usa datos reales (INEGI + Apify).
// La versión anterior, con datos simulados, solo se abre con ?demo=1.
const isDemo = new URLSearchParams(window.location.search).has('demo');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDemo ? <App /> : <RealProspector />}
  </StrictMode>,
);
