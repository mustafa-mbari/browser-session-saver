export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  ms: number,
): (...args: A) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<A extends unknown[]>(
  fn: (...args: A) => unknown,
  ms: number,
): (...args: A) => void {
  let lastCall = 0;
  return (...args: A) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}
