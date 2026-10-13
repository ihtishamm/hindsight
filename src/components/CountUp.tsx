import { useEffect, useState } from 'react';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animates a number from 0 up to `target` with an ease-out curve, so big
 * figures land quickly and settle gently. Restarts whenever `key` changes.
 */
export function useCountUp(target: number, { duration = 900, delay = 0, key }: { duration?: number; delay?: number; key?: unknown } = {}) {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setValue(target);
      return;
    }
    setValue(0);
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, key]);
  return value;
}

/** A number that counts up on mount; `decimals` controls the display. */
export function CountUp({ value, decimals = 0, delay = 0, duration, animKey }: { value: number; decimals?: number; delay?: number; duration?: number; animKey?: unknown }) {
  const v = useCountUp(value, { delay, duration, key: animKey });
  return <>{v.toFixed(decimals)}</>;
}
