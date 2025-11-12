export const Collaborators = () => {
  // Placeholder data - will be replaced with real collaboration data in the future
  const currentUser = {
    name: 'You',
    role: 'Owner',
    isOnline: true,
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
        Collaborators
      </h3>
      
      <div className="flex flex-col gap-2">
        {/* Current user */}
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200/50 transition-colors">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            {currentUser.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-base-100" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">{currentUser.name}</div>
            <div className="text-xs text-base-content/60">{currentUser.role}</div>
          </div>
        </div>
        
        {/* Future collaborators placeholder */}
        <div className="text-center text-base-content/30 py-6 border border-dashed border-base-300 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 mx-auto mb-2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
            />
          </svg>
          <p className="text-xs">
            Online collaboration
            <br />
            coming soon
          </p>
        </div>
      </div>
    </div>
  );
};

