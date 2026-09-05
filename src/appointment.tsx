import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppointmentPage } from './components/AppointmentPage';

// Public booking page — anyone can SUBMIT a request; Firestore rules make
// sure nobody can read other people's requests (staff-only).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppointmentPage />
  </StrictMode>,
);
