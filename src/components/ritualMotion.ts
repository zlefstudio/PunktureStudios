/**
 * Decorative character acting for the live-queue avatar, not actual procedure progress.
 *
 * Two moods:
 * - Waiting for tools (before the first one and in short gaps): a gentle, smooth bounce in place,
 *   like happily waiting. Vertical only, so it never reads as shaking the head.
 * - A tool is arriving or working: the avatar settles completely (`excite` fades to 0 well
 *   before contact) so every tool lands on the same still, aligned spot.
 */
/** 14s procedure + 1.2s of excited waiting; the wait continues into the next loop's first 1.5s. */
export const RITUAL_LOOP = 15.2;
const RITUAL_END = 14;

const mod = (value: number, size: number) => ((value % size) + size) % size;
const smooth = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
/** Ramp up a→b, hold, ramp down c→d. */
const trapezoid = (t: number, a: number, b: number, c: number, d: number) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
const pulse = (t: number, start: number, duration: number) => t > start && t < start + duration ? Math.sin((t - start) / duration * Math.PI) ** 2 : 0;
/** The happy "yes" nod: one full nod, then a softer second one right after. */
const yesNod = (t: number, start: number) => pulse(t, start, .44) + .65 * pulse(t, start + .44, .4);

/**
 * How excited the avatar is, 0 (steady) to 1. It reaches 0 by 1.85s, while the cotton swab is
 * still gliding in and a full 0.15s before it touches down at 2.0s. The short gap between the swab
 * and the marker gets a smaller bounce. (The gaps after the marker and the mirror are filled by a
 * "yes" nod instead.)
 */
export function excitement(time: number) {
  const t = mod(time, RITUAL_LOOP);
  // Seconds since the wait began; continuous across the loop restart (15.2s → 0s).
  const wait = t >= RITUAL_END ? t - RITUAL_END : t + (RITUAL_LOOP - RITUAL_END);
  const main = trapezoid(wait, 0.05, 0.6, 2.4, 3.05);
  const gapA = 0.55 * trapezoid(t, 2.95, 3.2, 3.45, 3.85);
  return { wait, main, gap: gapA, weight: Math.max(main, gapA) };
}

/**
 * A soft, smooth bounce, like waiting happily in place: straight up and down only (no sway, tilt
 * or shake). sin² eases into and out of the floor, so there is no hard landing. `u` must be
 * continuous in time.
 */
function perk(u: number) {
  const period = 1.3;
  const air = Math.sin(u / period * Math.PI) ** 2;
  return { y: -air * 4.5, air };
}

export function ritualMotion(time: number) {
  const t = mod(time, RITUAL_LOOP);
  const breath = Math.sin(t / RITUAL_LOOP * Math.PI * 4);
  // "Yes" nods as the marker leaves (4.65s) and as the mirror leaves (6.95s, done before the forceps land).
  const nod = yesNod(t, 4.65) + yesNod(t, 6.95);
  // One quick recoil when the needle first contacts, followed by a softer release.
  const flinch = pulse(t, 9.95, .24);
  const recover = pulse(t, 10.19, .42);
  const happy = pulse(t, 13, .5) + .6 * pulse(t, 13.5, .5);

  const e = excitement(t);
  const wait = perk(e.wait);
  const gap = perk(t);
  // The long wait uses its own continuous clock, the short gaps use loop time.
  const air = wait.air * e.main + gap.air * e.gap;

  return {
    excite: e.weight,
    x: -flinch * 4 + recover,
    y: breath * 2.2 + nod * 6 - flinch * 5 + recover * 1.5 - happy * 11 + wait.y * e.main + gap.y * e.gap,
    rot: -flinch * 3 + recover * 1.2 + pulse(t, 13, .5) * 2 - pulse(t, 13.5, .5) * 1.5,
    scaleX: 1 + flinch * .025 - air * .006,
    scaleY: 1 - nod * .05 - flinch * .035 + happy * .018 + air * .014,
    shadowScale: 1 + breath * .018 - happy * .06 - air * .07,
    shadowOpacity: .3 - breath * .015 - happy * .04 - air * .05,
  };
}
