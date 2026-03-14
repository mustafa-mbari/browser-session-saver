import { type ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'bottom' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const GAP = 6;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - GAP;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - GAP;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        break;
    }

    setCoords({ top, left });
  }, [show, position]);

  const transformMap: Record<string, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  };

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              transform: transformMap[position],
              zIndex: 9999,
            }}
            className="px-2 py-1 text-xs rounded bg-gray-900 text-white whitespace-nowrap pointer-events-none"
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
