import '@fontsource/special-elite/latin-400.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './app/styles.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Ilova konteyneri topilmadi.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
