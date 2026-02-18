import { useEffect, useState, useRef } from "react";

/**
 * Animates a number from 0 to target value.
 * Lightweight — uses requestAnimationFrame with easeOutExpo.
 */
export function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (!enabled || target === prevTarget.current) {
      if (!enabled) setValue(target);
      return;
    }

    const from = prevTarget.current;
    prevTarget.current = target;
    const diff = target - from;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(from + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration, enabled]);

  return value;
}
