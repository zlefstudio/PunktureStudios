/** Decorative character acting, not actual procedure progress. */
export function ritualMotion(time: number) {
  const t = ((time % 14) + 14) % 14;
  const pulse = (start: number, duration: number) => t > start && t < start + duration ? Math.sin((t - start) / duration * Math.PI) ** 2 : 0;
  const breath = Math.sin(t / 14 * Math.PI * 4);
  const nod = pulse(4.65, .44) + .65 * pulse(5.09, .4);
  // One quick recoil when the needle first contacts, followed by a softer release.
  const flinch = pulse(9.95, .24);
  const recover = pulse(10.19, .42);
  const happy = pulse(13, .5) + .6 * pulse(13.5, .5);
  return {
    x: -flinch * 4 + recover,
    y: breath * 2.2 + nod * 6 - flinch * 5 + recover * 1.5 - happy * 11,
    rot: -flinch * 3 + recover * 1.2 + pulse(13, .5) * 2 - pulse(13.5, .5) * 1.5,
    scaleX: 1 + flinch * .025,
    scaleY: 1 - nod * .05 - flinch * .035 + happy * .018,
    shadowScale: 1 + breath * .018 - happy * .06,
    shadowOpacity: .3 - breath * .015 - happy * .04,
  };
}
