"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
  suffix?: string;
  duration?: number;
}

/**
 * Counts from the previously-rendered value up (or down) to the new one.
 * Writes straight to the DOM node via onUpdate rather than through state,
 * so a ~60fps tween doesn't re-render the whole dashboard on every frame.
 */
export function CountUp({ value, suffix = "", duration = 0.9 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduceMotion) {
      node.textContent = `${value}${suffix}`;
      previous.current = value;
      return;
    }

    const controls = animate(previous.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = `${Math.round(latest)}${suffix}`;
      },
    });

    previous.current = value;
    return () => controls.stop();
  }, [value, suffix, duration, reduceMotion]);

  // Rendered server-side and on first paint before the tween attaches —
  // showing the real value keeps it correct with JS disabled.
  return <span ref={ref}>{`${value}${suffix}`}</span>;
}
