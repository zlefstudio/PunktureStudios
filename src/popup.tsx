import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PopupEventPage } from './components/PopupEventPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PopupEventPage />
  </StrictMode>,
);
