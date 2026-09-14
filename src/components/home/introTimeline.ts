import { ORBIT, orbitPose } from './orbitMath';

/** Seconds except preloadCapMs. One clock owns every intro actor. */
export const INTRO = {
  preloadCapMs: 850,
  duration: 2.12,
  stageDuration: 0.62,
  cardStart: 0.2,
  cardStagger: 0.045,
  cardDuration: 1.25,
  scatterX: 0.23, // viewport-width fraction; deterministic, never randomized on reload
  scatterY: 0.3, // stage-height fraction
  scatterScale: 0.42,
  scatterRotation: 22,
  logoDuration: 1.52,
  headerStart: 0.72,
  chromeStagger: 0.1,
  chromeDuration: 0.65,
  bottomStart: 1.28,
  grainStart: 1.15,
};
export const INTRO_ANGLE = ORBIT.initialAngle;
export type IntroGate = { ready: boolean };
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const introProgress = (time: number, start: number, duration: number) => clamp01((time - start) / duration);
// Quintic ease-out: fast gathering, long controlled landing, zero terminal velocity.
export const settle = (progress: number) => 1 - Math.pow(1 - clamp01(progress), 5);

export function introCard(index: number, count: number, width: number, height: number, time: number) {
  const pose = orbitPose(INTRO_ANGLE + index / count * Math.PI * 2, width, height);
  const start = INTRO.cardStart + index * INTRO.cardStagger;
  const progress = settle(introProgress(time, start, INTRO.cardDuration));
  const scatter = 1 - progress;
  const direction = index * 2.399963229728653; // golden angle: reproducible scattered composition
  const appear = introProgress(time, 0.04 + index * 0.012, 0.2);
  return {
    x: pose.x + Math.cos(direction) * width * INTRO.scatterX * scatter,
    y: pose.y + Math.sin(direction) * height * INTRO.scatterY * scatter,
    scale: pose.scale * (INTRO.scatterScale + (1 - INTRO.scatterScale) * progress),
    rotation: scatter === 0 ? 0 : Math.sin(direction + 1) * INTRO.scatterRotation * scatter,
    opacity: pose.opacity * appear * (0.16 + 0.84 * progress),
    blurOpacity: (pose.blur / 1.6 * 0.8) + (1 - pose.blur / 1.6 * 0.8) * scatter,
    zIndex: pose.zIndex,
  };
}

export function introTransform(pose: ReturnType<typeof introCard>) {
  return `translate3d(${pose.x}px,${pose.y}px,0) translate(-50%,-50%) scale(${pose.scale}) rotate(${pose.rotation}deg)`;
}

