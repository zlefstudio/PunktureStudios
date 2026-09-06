import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PrivacyPage } from './components/PrivacyPage';

// Public privacy + legal notice page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyPage />
  </StrictMode>,
);
