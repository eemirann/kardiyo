import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

/**
 * Ikon fontu yuklenene kadar ikonlar gizli (bkz. index.css); yuklenince gorunur.
 * Font hic gelmezse 3 saniye sonra yine de acilir, sayfa ikonsuz da olsa calisir.
 */
const showIcons = () => document.documentElement.classList.add('fonts-ready');
if (document.fonts?.ready) document.fonts.ready.then(showIcons);
else showIcons();
setTimeout(showIcons, 3000);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
