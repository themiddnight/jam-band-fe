import { useEffect, useState } from 'react';

interface PlayingIndicatorProps {
  velocity: number;
}

export const PlayingIndicator = ({ velocity }: PlayingIndicatorProps) => {
  const [trigger, setTrigger] = useState(false);
  const [updatedVelocity, setUpdatedVelocity] = useState(velocity);

  useEffect(() => {
    if (velocity > 0) {
      setUpdatedVelocity(velocity);
      setTrigger(true);
      setTimeout(() => {
        setTrigger(false);
      }, 100);
    }
  }, [velocity]);

  return (
    <div className='relative w-2 h-2 rounded-full overflow-hidden'>
      <div className='absolute w-full h-full bg-neutral-500/50' />
      <div
        className={`absolute w-full h-full ${trigger ? "user-on" : "user-off"}`}
        style={{
          backgroundColor: `hsl(120, ${updatedVelocity * 100}%, 50%)`,
        }}
      />
    </div>
  );
};

export default PlayingIndicator; 