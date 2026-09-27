import { useEffect, useState } from 'react';
import { getLocalPublicSettings } from '../sync';
import { upgradeLegacySchedule } from '../schedule';
import type { PublicSettings } from '../types';
import { AppointmentPage } from './AppointmentPage';

/** DEV entry only. Draft storage is separate from Dexie and cloud sync. */
export function LocalBookingPreview() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const draft = new URLSearchParams(window.location.search).get('preview') === 'draft'
        ? window.localStorage.getItem('punkture.booking-preview.v1') : null;
      const value = draft ? JSON.parse(draft) as PublicSettings : await getLocalPublicSettings();
      if (active) setSettings(upgradeLegacySchedule(value ?? { key: 'public', updatedAt: 0, eventActive: false, bookingEnabled: false }));
    })().catch(() => { if (active) setError('Cannot load the preview. Open studio settings in this browser and save a new preview draft.'); });
    return () => { active = false; };
  }, []);
  if (error) return <p role="alert">{error}</p>;
  return settings ? <AppointmentPage previewSettings={settings} /> : <p>Loading private preview…</p>;
}
