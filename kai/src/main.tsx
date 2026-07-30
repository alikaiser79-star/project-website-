import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './sovereign.css';
import { startSW } from './lib/pwa';
import { installApiAuth } from './lib/apiAuth';

/* Before the first render, so no early fetch escapes without the header. */
installApiAuth();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

startSW();
