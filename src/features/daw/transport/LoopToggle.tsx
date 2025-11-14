import { useProjectStore } from '../stores/projectStore';

export const LoopToggle = () => {
  const loopEnabled = useProjectStore((state) => state.loop.enabled);
  const toggleLoop = useProjectStore((state) => state.toggleLoop);

  return (
    <button
      type="button"
      onClick={() => toggleLoop()}
      className={`btn btn-xs ${loopEnabled ? 'btn-warning' : 'btn-ghost'}`}
      title={loopEnabled ? 'Loop: ON' : 'Loop: OFF'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4 sm:w-5 sm:h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
      <span className="hidden sm:inline ml-1">Loop</span>
    </button>
  );
};

