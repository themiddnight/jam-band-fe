import { useState } from 'react';
import EffectChain from './EffectChain';

export default function EffectsChainSection() {
  const [activeTab, setActiveTab] = useState<'virtual_instrument' | 'audio_voice_input'>('virtual_instrument');

  return (
    <div className="effects-chain-section w-full bg-base-100 rounded-lg p-3 shadow-sm">
      <div className='flex justify-between items-center'>
        <h2 className="text-lg font-semibold text-base-content mb-3 flex items-center gap-2">
          <span>Audio Effects</span>
        </h2>
        {/* Tab Headers */}
        <div className="tabs tabs-bordered mb-3 join">
          <button
            className={`join-item btn btn-sm ${activeTab === 'virtual_instrument' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('virtual_instrument')}
          >
            🎹 Virtual Instrument
          </button>
          <button
            className={`join-item btn btn-sm ${activeTab === 'audio_voice_input' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('audio_voice_input')}
          >
            🎤 Audio Voice Input
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content block">
        {activeTab === 'virtual_instrument' && (
          <EffectChain
            chainType="virtual_instrument"
            title="Virtual Instrument Effects"
          />
        )}
        
        {activeTab === 'audio_voice_input' && (
          <EffectChain
            chainType="audio_voice_input"
            title="Audio Voice Input Effects"
          />
        )}
      </div>
    </div>
  );
}
