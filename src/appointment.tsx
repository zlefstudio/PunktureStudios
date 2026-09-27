import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './components/booking/piercing-map.css';
import { AppointmentPage } from './components/AppointmentPage';

// Local development is a no-payment preview. The production build excludes the
// local settings reader; URL parameters cannot enable preview on the public site.
const BookingPage = import.meta.env.DEV
  ? lazy(() => import('./components/LocalBookingPreview').then(module => ({ default: module.LocalBookingPreview })))
  : AppointmentPage;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<p>Loading booking page…</p>}><BookingPage /></Suspense>
  </StrictMode>,
);
