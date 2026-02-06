import { useTypewriter } from '../hooks/useTypewriter';
import { useEffect } from 'preact/hooks';
import { cn } from '../lib/utils';

interface TypewriterTitleProps {
  text: string;
  animate: boolean;
  onAnimationComplete?: () => void;
}

export function TypewriterTitle({ text, animate, onAnimationComplete }: TypewriterTitleProps) {
  const { displayText, isAnimating } = useTypewriter(text, { enabled: animate });

  useEffect(() => {
    if (!isAnimating && animate && onAnimationComplete) {
      onAnimationComplete();
    }
  }, [isAnimating, animate, onAnimationComplete]);

  return (
    <span className="inline-flex items-center min-w-0">
      <span className="truncate">{displayText}</span>
      {isAnimating && (
        <span
          className={cn(
            'inline-block w-[2px] h-[14px] ml-0.5 flex-shrink-0',
            'bg-text-primary dark:bg-text-primary-dark',
            'animate-pulse'
          )}
        />
      )}
    </span>
  );
}
