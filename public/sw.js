// Minimal service worker for Carbonify (avoids MIME type error on Vercel)
// Cache-busting and optional offline support can be added later.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => self.clients.claim())
