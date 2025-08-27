import { useState } from 'react';

export const TechnicalInfoPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const technicalInfo = [
    {
      icon: '🌐',
      title: 'WebRTC Mesh Network',
      description: 'Currently using WebRTC mesh for low-latency (POC). Limited participants per session.',
      status: 'Current'
    },
    {
      icon: '🎤',
      title: 'Voice Latency',
      description: 'Depends on browser and hardware. Cannot bypass browser audio processing.',
      status: 'Browser Dependent'
    },
    {
      icon: '🌍',
      title: 'Server Location',
      description: 'Southeast Asia only. Latency varies by location.',
      status: 'SE Asia'
    },
    {
      icon: '📡',
      title: 'Network',
      description: 'LAN cable recommended over WiFi/cellular for best performance.',
      status: 'Recommended'
    },
    {
      icon: '🔌',
      title: 'MIDI & Browser',
      description: 'Chromium browsers recommended for full MIDI support and all instruments.',
      status: 'Chromium'
    }
  ];

  return (
      <div className="card-body p-4">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">ℹ️</span>
            <h3 className="card-title text-base">Technical Info</h3>
          </div>
          <button className="btn btn-ghost btn-sm">
            {isExpanded ? '−' : '+'}
          </button>
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-3">
            {technicalInfo.map((info, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                <span className="text-lg">{info.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm">{info.title}</h4>
                    <span className="badge badge-outline badge-xs">{info.status}</span>
                  </div>
                  <p className="text-xs text-base-content/70">{info.description}</p>
                </div>
              </div>
            ))}
            
            <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-info">💡</span>
                <div className="text-xs text-base-content/80">
                  <p className="font-medium mb-1">Pro Tips:</p>
                  <ul className="space-y-1">
                    <li>• Use headphones to avoid feedback</li>
                    <li>• Close unnecessary browser tabs</li>
                    <li>• Test audio before joining</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}; 