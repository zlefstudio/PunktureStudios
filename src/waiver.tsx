import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { WaiverPage } from './components/WaiverPage';

// Public paperless waiver / consent gate. Privacy-first: no data is collected.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WaiverPage />
  </StrictMode>,
);
