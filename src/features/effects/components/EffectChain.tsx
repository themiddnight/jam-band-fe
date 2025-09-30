import { useState, useRef } from 'react';
import type { EffectType, EffectChainType } from '@/features/effects/types';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { EFFECT_CONFIGS, EFFECT_ORDER } from '@/features/effects/constants/effectConfigs';
import { AnchoredPopup } from '@/features/ui';
import EffectModule from './EffectModule';

interface EffectChainProps {
  chainType: EffectChainType;
  title: string;
}

export default function EffectChain({ chainType, title }: EffectChainProps) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null);

  const { chains, addEffect, clearChain, reorderEffects } = useEffectsStore();
  const chain = chains[chainType];

  const handleAddEffect = (effectType: EffectType) => {
    addEffect(chainType, effectType);
    setShowAddMenu(false);
  };

  const handleClearChain = () => {
    clearChain(chainType);
  };

  const handleDragStart = (effectId: string) => {
    setDraggingEffectId(effectId);
  };

  const handleDragEnd = () => {
    setDraggingEffectId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggingEffectId) return;
    
    const sourceIndex = chain.effects.findIndex(effect => effect.id === draggingEffectId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return;
    
    reorderEffects(chainType, sourceIndex, targetIndex);
    setDraggingEffectId(null);
  };

  const sortedEffects = [...chain.effects].sort((a, b) => a.order - b.order);

  return (
    <div className='effect-chain p-3 rounded-lg border border-base-300 bg-base-100'>
      {/* Chain Header */}
      <div className="flex items-center justify-between mb-4">
        <h3>{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/70">
            {sortedEffects.length} effect{sortedEffects.length !== 1 ? 's' : ''}
          </span>
          {sortedEffects.length > 0 && (
            <button
              onClick={handleClearChain}
              className="btn btn-xs btn-ghost btn-error"
              title="Clear all effects"
            >
              Clear
            </button>
          )}
          <button
            ref={addButtonRef}
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn btn-xs btn-primary"
            title="Add effect"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Effects Chain */}
      <div className="flex flex-wrap gap-5 items-start">
        {sortedEffects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-50">
            <div className="text-center">
              <p>No effects in chain</p>
              <p className="text-xs">Click "Add" to add an effect</p>
            </div>
          </div>
        ) : (
          sortedEffects.map((effect, index) => (
            <div
              key={effect.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="relative"
            >
              <EffectModule
                effect={effect}
                chainType={chainType}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={draggingEffectId === effect.id}
                canReorder={sortedEffects.length > 1}
              />
              
              {/* Signal flow arrow */}
              {index < sortedEffects.length - 1 && (
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 text-primary text-lg z-10">
                  →
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Effect Popup */}
      <AnchoredPopup
        open={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        anchorRef={addButtonRef}
        placement="bottom"
        className="w-64"
      >
        <div className="p-3">
          <h4 className="font-semibold text-sm mb-3">Add Effect</h4>
          <div className="grid grid-cols-1 gap-1">
            {EFFECT_ORDER.map((effectType) => {
              const config = EFFECT_CONFIGS[effectType];
              return (
                <button
                  key={effectType}
                  onClick={() => handleAddEffect(effectType)}
                  className="btn btn-sm btn-ghost justify-start gap-2"
                >
                  <span>{config.icon}</span>
                  <span>{config.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </AnchoredPopup>
    </div>
  );
}
