import { memo } from 'react';

interface BeatHeaderCellProps {
  beatIndex: number;
  onBeatSelect: (beat: number) => void;
  onCurrentBeatChange: (beat: number) => void;
}

export const BeatHeaderCell = memo(({
  beatIndex,
  onBeatSelect,
  onCurrentBeatChange,
}: BeatHeaderCellProps) => {
  const isDownbeat = beatIndex % 4 === 0;

  return (
    <div
      className={`
        flex items-center justify-center w-full h-full
        text-xs font-medium select-none cursor-pointer
        border-r border-b border-base-200 bg-base-200/50
        hover:bg-primary hover:text-primary-content transition-colors
        ${isDownbeat ? 'text-base-content' : 'text-base-content/50'}
      `}
      onClick={() => onCurrentBeatChange(beatIndex)}
      onDoubleClick={() => onBeatSelect(beatIndex)}
    >
      {beatIndex + 1}
    </div>
  );
});

BeatHeaderCell.displayName = 'BeatHeaderCell';
