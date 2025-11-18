import { useLockStore } from '../stores/lockStore';

interface LockIndicatorProps {
  elementId: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Component to display lock indicator with username
 */
export const LockIndicator = ({
  elementId,
  position = 'top',
  className = '',
}: LockIndicatorProps) => {
  const lock = useLockStore((state) => state.isLocked(elementId));

  if (!lock) {
    return null;
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-50 ${className}`}
      title={`Locked by ${lock.username}`}
    >
      <div className="badge badge-sm badge-warning gap-1 whitespace-nowrap">
        <span>🔒</span>
        <span>{lock.username}</span>
      </div>
    </div>
  );
};

