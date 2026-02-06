import { useState, useEffect, useRef } from 'preact/hooks';

interface UseTypewriterOptions {
  speed?: number; // ms per character
  enabled?: boolean;
}

interface UseTypewriterResult {
  displayText: string;
  isAnimating: boolean;
}

/**
 * Hook for typewriter animation effect.
 * Respects prefers-reduced-motion.
 */
export function useTypewriter(
  targetText: string,
  { speed = 40, enabled = true }: UseTypewriterOptions = {}
): UseTypewriterResult {
  const [displayText, setDisplayText] = useState(targetText);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTargetRef = useRef(targetText);

  useEffect(() => {
    // Only animate when targetText changes and enabled
    if (targetText === prevTargetRef.current || !enabled) {
      prevTargetRef.current = targetText;
      setDisplayText(targetText);
      return;
    }

    prevTargetRef.current = targetText;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayText(targetText);
      return;
    }

    setIsAnimating(true);
    setDisplayText('');

    let charIndex = 0;
    const timer = setInterval(() => {
      charIndex++;
      if (charIndex >= targetText.length) {
        setDisplayText(targetText);
        setIsAnimating(false);
        clearInterval(timer);
      } else {
        setDisplayText(targetText.slice(0, charIndex));
      }
    }, speed);

    return () => {
      clearInterval(timer);
    };
  }, [targetText, enabled, speed]);

  return { displayText, isAnimating };
}
