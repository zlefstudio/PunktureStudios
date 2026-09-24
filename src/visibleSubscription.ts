/** Release public listeners after 30s hidden; short tab switches keep their connection. */
export function whilePageVisible(subscribe: () => () => void, resumed: () => void = () => {}) {
  let stop: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const visibility = () => {
    clearTimeout(timer);
    if (document.hidden) {
      timer = setTimeout(() => { stop?.(); stop = undefined; }, 30000);
    } else if (!stop) {
      resumed();
      stop = subscribe();
    }
  };
  visibility();
  document.addEventListener('visibilitychange', visibility);
  return () => {
    clearTimeout(timer);
    stop?.();
    document.removeEventListener('visibilitychange', visibility);
  };
}
