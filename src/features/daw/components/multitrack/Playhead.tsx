interface PlayheadProps {
  playheadBeats: number;
  pixelsPerBeat: number;
  zoom: number;
  height: number;
}

export const Playhead = ({
  playheadBeats,
  pixelsPerBeat,
  zoom,
  height,
}: PlayheadProps) => {
  // Position at absolute location - browser handles scroll viewport
  const x = playheadBeats * pixelsPerBeat * zoom;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 w-0.5 bg-primary shadow-[0_0_6px_rgba(59,130,246,0.4)]"
      style={{
        transform: `translateX(${x}px)`,
        height,
      }}
    />
  );
};

