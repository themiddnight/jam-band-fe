import { useEffect, useState, useRef } from 'react';
import type { EffectType, EffectChainType, EffectChainPreset } from '@/features/effects/types';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { EFFECT_CONFIGS, EFFECT_ORDER } from '@/features/effects/constants/effectConfigs';
import { DEFAULT_EFFECT_CHAIN_PRESETS } from '@/features/effects/constants/defaultPresets';
import { effectChainPresetValidator } from '@/shared/hooks/presetManagement';
import { PresetManager } from '@/shared/components';
import { AnchoredPopup } from '@/features/ui';
import EffectModule from './EffectModule';

interface EffectChainProps {
  chainType: EffectChainType;
  title: string;
  mode?: 'perform'| 'arrange' ;
}

export default function EffectChain({ chainType, title, mode = 'perform' }: EffectChainProps) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [draggingEffectId, setDraggingEffectId] = useState<string | null>(null);

  const { chains, addEffect, clearChain, reorderEffects, loadPreset, ensureChain } = useEffectsStore();
  const chain = chains[chainType];

  useEffect(() => {
    ensureChain(chainType);
  }, [chainType, ensureChain]);

  if (!chain) {
    return (
      <div className='effect-chain p-3 rounded-lg border border-base-300 bg-base-100'>
        <div className="text-sm text-base-content/60">Initializing effect chain…</div>
      </div>
    );
  }

  const handleAddEffect = (effectType: EffectType) => {
    addEffect(chainType, effectType);
    setShowAddMenu(false);
  };

  const handleClearChain = () => {
    clearChain(chainType);
  };

  const handleSavePreset = (partialPreset: Partial<EffectChainPreset>): EffectChainPreset => {
    return {
      ...partialPreset,
      chainType,
      effects: chain.effects.map((effect) => ({
        type: effect.type,
        bypassed: effect.bypassed,
        parameters: effect.parameters.reduce((acc, param) => {
          acc[param.name] = param.value;
          return acc;
        }, {} as Record<string, number>),
      })),
    } as EffectChainPreset;
  };

  const handleLoadPreset = (preset: EffectChainPreset) => {
    loadPreset(chainType, preset);
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
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3>{title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Centralized Preset Manager */}
          {mode === 'perform' && (
            <PresetManager<EffectChainPreset>
              storageKey="jam-band-effect-chain-presets"
              version="1.0.0"
              validator={effectChainPresetValidator}
              currentContext={{ chainType }}
              contextDescription={`the current chain type (${chainType})`}
              filterPresets={(preset) => preset.chainType === chainType}
              getExportFilename={() => `effect-chain-presets-${chainType}.json`}
              onSave={handleSavePreset}
              onLoad={handleLoadPreset}
              saveButtonDisabled={chain.effects.length === 0}
              size="xs"
              additionalPresets={DEFAULT_EFFECT_CHAIN_PRESETS as any}
            />
          )}

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
      <div className="flex flex-wrap gap-x-5 gap-y-2 items-start">
        {sortedEffects.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-50">
            <div className="text-center">
              <p>No effects in chain</p>
              {mode === 'perform' && <p className="text-xs">Click "Add" to add an effect or load a preset</p>}
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
