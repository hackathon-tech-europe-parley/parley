"use client";
import { useEffect, useRef, useState } from "react";

interface TypewriterTextProps {
  text: string;
  /** Characters revealed per second */
  speed?: number;
  className?: string;
}

export function TypewriterText({
  text,
  speed = 60,
  className,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState(text);
  const prevText = useRef(text);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;

    // Cancel any running animation
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);

    const interval = 1000 / speed;
    let charIndex = 0;
    let lastTime = 0;

    setDisplayed("");

    function step(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const elapsed = timestamp - lastTime;

      if (elapsed >= interval) {
        const charsToAdd = Math.min(
          Math.floor(elapsed / interval),
          text.length - charIndex,
        );
        charIndex += charsToAdd;
        setDisplayed(text.slice(0, charIndex));
        lastTime = timestamp - (elapsed % interval);
      }

      if (charIndex < text.length) {
        rafId.current = requestAnimationFrame(step);
      } else {
        rafId.current = null;
      }
    }

    rafId.current = requestAnimationFrame(step);

    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [text, speed]);

  return <span className={className}>{displayed}</span>;
}
