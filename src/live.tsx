import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './components/liveQueue.css';
import { LiveQueuePage } from './components/LiveQueuePage';

const QueuePage = import.meta.env.DEV
  ? lazy(() => import('./components/LocalLiveQueuePreview').then(module => ({ default: module.LocalLiveQueuePreview })))
  : LiveQueuePage;

// Public customer-facing page — reads only the sanitized `publicQueue`
// collection (ticket numbers + status; no names ever).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p>Loading queue…</p>}><QueuePage /></Suspense>
  </StrictMode>,
);
