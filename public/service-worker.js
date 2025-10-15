// Simple service worker for heartbeat
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  self.clients.claim();
});

function sendHeartbeat() {
  // You can customize this to call your backend or update local state
  console.log('Service Worker Heartbeat sent at', new Date().toISOString());
  // Example: fetch('/api/heartbeat', { method: 'POST' });
}

setInterval(sendHeartbeat, 1800000); // 30 minutes
