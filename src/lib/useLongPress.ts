import React from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onFinish?: () => void;
}

export function useLongPress(callback: (e: React.PointerEvent) => void, options: UseLongPressOptions = {}) {
  const { threshold = 500, onFinish } = options;
  const [isPressed, setIsPressed] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsPressed(true);
    timerRef.current = window.setTimeout(() => {
      callback(e);
      setIsPressed(false);
      onFinish?.();
    }, threshold);
  }, [callback, threshold, onFinish]);

  const handlePointerUp = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
  }, []);

  const handlePointerLeave = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    style: { touchAction: 'none', userSelect: 'none' as const }
  };
}
