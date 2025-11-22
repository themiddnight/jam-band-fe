import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  children: React.ReactNode;
  className?: string;
}

export const InfoTooltip = ({ children, className = '' }: InfoTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isVisible && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8, // 8px gap from icon
      });
    }
  }, [isVisible]);

  return (
    <div className={`relative inline-flex ${className}`}>
      <svg
        ref={iconRef}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="w-4 h-4 stroke-current text-base-content/50 hover:text-base-content/70 cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] max-w-xs pointer-events-none"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="bg-neutral text-neutral-content text-xs rounded-lg shadow-lg px-3 py-2">
              {children}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
