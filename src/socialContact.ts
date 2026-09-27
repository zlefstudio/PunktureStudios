/**
 * Customers leave a social media account instead of a phone number, so the
 * studio can message them over data (no load needed). The booking stores one
 * readable string, e.g. "Instagram: @mayasantos", in the existing `contact` field.
 */
export type SocialApp = 'instagram' | 'facebook' | 'tiktok' | 'other';

export const SOCIAL_APPS: { id: SocialApp; label: string; placeholder: string }[] = [
  { id: 'instagram', label: 'Instagram', placeholder: '@yourusername' },
  { id: 'facebook', label: 'Facebook', placeholder: 'Your Facebook name or profile link' },
  { id: 'tiktok', label: 'TikTok', placeholder: '@yourusername' },
  { id: 'other', label: 'Other app', placeholder: 'e.g. Telegram @yourusername' },
];

const NAMES: Record<SocialApp, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', other: 'Other' };
/** The Worker accepts up to 80 characters for `contact`. */
const MAX_CONTACT = 80;

export function socialContact(app: SocialApp, raw: string): { value: string } | { error: string } {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return { error: 'Please add your social media so we can message you about your appointment.' };
  if (app === 'instagram' || app === 'tiktok') {
    // Accept "@name", "name" or a pasted profile link.
    const handle = text
      .replace(/^(https?:\/\/)?(www\.|m\.)?(instagram\.com|tiktok\.com)\//i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, '');
    const max = app === 'instagram' ? 30 : 24;
    if (!new RegExp(`^[A-Za-z0-9._]{1,${max}}$`).test(handle)) return { error: `Please enter a valid ${NAMES[app]} username, like @mayasantos.` };
    return { value: `${NAMES[app]}: @${handle}` };
  }
  const value = `${NAMES[app]}: ${text}`;
  if (text.length < 2 || value.length > MAX_CONTACT) return { error: `Please enter your ${app === 'facebook' ? 'Facebook name or profile link' : 'app and username'} (up to 60 characters).` };
  return { value };
}

/** A safe link to message the customer, or null (phone numbers, free text). */
export function socialProfileLink(contact: string): { label: string; href: string } | null {
  const value = contact.trim();
  // Older bookings asked for an Instagram handle, so a bare "@name" is Instagram.
  const instagram = /^(?:Instagram: )?@([A-Za-z0-9._]{1,30})$/.exec(value);
  if (instagram) return { label: 'Open Instagram', href: `https://www.instagram.com/${instagram[1]}/` };
  const tiktok = /^TikTok: @([A-Za-z0-9._]{1,24})$/.exec(value);
  if (tiktok) return { label: 'Open TikTok', href: `https://www.tiktok.com/@${tiktok[1]}` };
  const facebook = /^Facebook: (.+)$/.exec(value);
  if (facebook) {
    const link = /^(?:https?:\/\/)?(?:(?:www|m|web)\.)?(?:facebook\.com|fb\.com|m\.me)\/\S+$/i.exec(facebook[1]);
    if (link) return { label: 'Open Facebook', href: /^https?:\/\//i.test(link[0]) ? link[0] : `https://${link[0]}` };
    return { label: 'Find on Facebook', href: `https://www.facebook.com/search/people/?q=${encodeURIComponent(facebook[1])}` };
  }
  return null;
}
