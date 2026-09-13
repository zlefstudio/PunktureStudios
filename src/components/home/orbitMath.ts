export const ORBIT = {
  idleSpeed: 0.075, // radians per second
  dragSensitivity: -0.0055, // radians per CSS pixel; front cards follow the pointer
  friction: 3.2, // exponential decay per second (same feel at 30/60/120Hz)
  maxVelocity: 4.5,
  clickDistance: 7,
  clickDuration: 350,
  releaseTimeout: 90,
  expandDuration: 0.78,
  closeDuration: 0.48,
};
export function orbitPose(angle: number, width: number, height: number) {
  const depth = (Math.sin(angle) + 1) / 2;
  return {
    x: Math.cos(angle) * width * (width < 600 ? 0.39 : 0.365),
    y: Math.sin(angle) * Math.max(38, Math.min(height * 0.32, height / 2 - (width < 360 ? 80 : width < 600 ? 106 : 132))),
    scale: 0.48 + depth * 0.52,
    opacity: 0.32 + depth * 0.68,
    blur: (1 - depth) * 1.6,
    zIndex: Math.round(depth * 100) + 2,
  };
}
export function advanceOrbit(angle: number, velocity: number, dt: number, idle: number) {
  const decay = Math.exp(-ORBIT.friction * dt);
  return { angle: angle + idle * dt + velocity * (1 - decay) / ORBIT.friction, velocity: velocity * decay };
}
export function isOrbitClick(distance: number, duration: number) {
  return distance <= ORBIT.clickDistance && duration <= ORBIT.clickDuration;
}
