import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  position?: 'right' | 'bottom' | 'left' | 'top';
  delay?: number;
}

export function Tooltip({ label, children, position = 'right', delay = 0 }: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(() => {
    const calc = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 8;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + gap;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - gap;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2;
          break;
        case 'top':
          top = rect.top - gap;
          left = rect.left + rect.width / 2;
          break;
      }

      setCoords({ top, left });
    };

    if (delay > 0) {
      timeout.current = setTimeout(calc, delay);
    } else {
      calc();
    }
  }, [position, delay]);

  const hide = useCallback(() => {
    clearTimeout(timeout.current);
    setCoords(null);
  }, []);

  const transformMap: Record<string, string> = {
    right: 'translateY(-50%)',
    left: 'translateX(-100%) translateY(-50%)',
    bottom: 'translateX(-50%)',
    top: 'translateX(-50%) translateY(-100%)',
  };

  return (
    <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {coords && createPortal(
        <div
          className="fixed z-[9999] px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 border border-slate-700 rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
          style={{
            top: coords.top,
            left: coords.left,
            transform: transformMap[position],
          }}
        >
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}
