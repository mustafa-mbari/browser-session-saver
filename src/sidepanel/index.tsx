import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import '@shared/styles/globals.css';
import '@shared/styles/themes.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
