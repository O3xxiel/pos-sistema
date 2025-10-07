// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css'; // Tailwind
import { apiLogin } from './data/api'; // tu cliente

// PWA Service Worker
import { registerSW } from 'virtual:pwa-register';

// Register service worker
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      // Show a notification or prompt user to refresh
      console.log('New content available, please refresh');
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}


const queryClient = new QueryClient();

declare global {
  interface Window {
    apiLogin?: typeof apiLogin;
  }
}

if (import.meta.env.DEV) {
  window.apiLogin = apiLogin;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
