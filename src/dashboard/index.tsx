import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@shared/styles/globals.css';
import '@shared/styles/themes.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
