import { useRef, useState } from 'react';
import type { EffectInstance, EffectChainType } from '@/features/effects/types';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { EFFECT_CONFIGS } from '@/features/effects/constants/effectConfigs';
import { AnchoredPopup, Knob } from '@/features/ui';

interface EffectModuleProps {
  effect: EffectInstance;
  chainType: EffectChainType;
  onDragStart?: (effectId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  canReorder?: boolean;
}

export default function EffectModule({
  effect,
  chainType,
  onDragStart,
  onDragEnd,
  isDragging = false,
  canReorder = true,
}: EffectModuleProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const {
    removeEffect,
    toggleEffectBypass,
    updateEffectParameter,
    resetEffect,
  } = useEffectsStore();

  const handleSettingsClick = () => {
    setShowSettings(!showSettings);
  };

  const handleDeleteClick = () => {
    removeEffect(chainType, effect.id);
  };

  const handleBypassClick = () => {
    toggleEffectBypass(chainType, effect.id);
  };

  const handleParameterChange = (parameterId: string, value: number) => {
    updateEffectParameter(chainType, effect.id, parameterId, value);
  };

  const handleResetClick = () => {
    resetEffect(chainType, effect.id);
    setShowSettings(false);
  };

  const renderParameterControl = (parameter: typeof effect.parameters[0]) => {
    if (parameter.type === 'knob') {
      return (
        <div key={parameter.id} className="flex flex-col items-center gap-1">
          <Knob
            value={parameter.value}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            onChange={(value) => handleParameterChange(parameter.id, value)}
            size={50}
            curve={parameter.curve}
            tooltipFormat={(val) => {
              if (parameter.unit) {
                return `${val.toFixed(3)}${parameter.unit}`;
              }
              return val.toFixed(3);
            }}
            color="primary"
          />
          <span className="text-xs text-center">{parameter.name}</span>
        </div>
      );
    } else {
      // slider type
      return (
        <div key={parameter.id} className="flex flex-col gap-1">
          <label className="text-xs">{parameter.name}</label>
          <input
            type="range"
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            value={parameter.value}
            onChange={(e) => handleParameterChange(parameter.id, parseFloat(e.target.value))}
            className="range range-primary range-sm"
          />
          <span className="text-xs text-center">
            {parameter.value.toFixed(3)}{parameter.unit || ''}
          </span>
        </div>
      );
    }
  };

  return (
    <>
      <div
        className={`
          effect-module relative flex flex-col items-center p-2 bg-base-200 rounded-lg border
          ${effect.bypassed ? 'border-base-300 opacity-60' : 'border-primary'}
          ${isDragging ? 'opacity-50' : ''}
          ${canReorder ? 'cursor-move' : ''}
          transition-all duration-150
        `}
        onMouseDown={canReorder ? () => onDragStart?.(effect.id) : undefined}
        onMouseUp={onDragEnd}
      >
        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Bypass Button */}
          <button
            onClick={handleBypassClick}
            className={`btn btn-xs ${
              effect.bypassed 
                ? 'btn-ghost text-base-content/50' 
                : 'btn-success'
            }`}
            title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
          >
            {effect.bypassed ? '⏸️' : '▶️'}
          </button>

          <span className="text-xs">{effect.name}</span>

          {/* Settings Button */}
          <button
            ref={settingsButtonRef}
            onClick={handleSettingsClick}
            className="btn btn-xs btn-ghost"
            title="Effect settings"
          >
            ⚙️
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            className="btn btn-xs btn-error btn-ghost"
            title="Remove effect"
          >
            🗑️
          </button>
        </div>

        {/* Drag Handle (if reorder is enabled) */}
        {canReorder && (
          <div className="absolute top-1 right-1 text-xs text-base-content/30">
            ⋮⋮
          </div>
        )}
      </div>

      {/* Settings Popup */}
      <AnchoredPopup
        open={showSettings}
        onClose={() => setShowSettings(false)}
        anchorRef={settingsButtonRef}
        placement="bottom"
        className="w-96"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {EFFECT_CONFIGS[effect.type]?.icon} {effect.name} Settings
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetClick}
                className="btn btn-xs btn-ghost"
                title="Reset to defaults"
              >
                🔄
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="btn btn-xs btn-ghost"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {effect.parameters.map(renderParameterControl)}
          </div>
        </div>
      </AnchoredPopup>
    </>
  );
}


