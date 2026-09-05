import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LiveQueuePage } from './components/LiveQueuePage';

// Public customer-facing page — reads only the sanitized `publicQueue`
// collection (ticket numbers + status; no names ever).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LiveQueuePage />
  </StrictMode>,
);
