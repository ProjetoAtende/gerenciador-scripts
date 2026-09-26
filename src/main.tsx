// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from "./contexts/AuthContext";
import { PermissoesProvider } from "./contexts/PermissoesContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import { HashRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <SimulationProvider>
          <PermissoesProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </PermissoesProvider>
        </SimulationProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);

