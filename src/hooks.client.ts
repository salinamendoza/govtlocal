import { startSync } from '$lib/client/syncManager';
import { flushOutbox } from '$lib/client/outbox';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { type: 'module' })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Service worker registration failed', err);
      });

    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'flush-outbox') void flushOutbox();
    });
  });
}

startSync();
