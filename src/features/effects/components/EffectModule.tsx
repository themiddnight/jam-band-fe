import { useCallback, useEffect, useRef, useState } from 'react';
import type { EffectInstance, EffectChainType } from '@/features/effects/types';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { EFFECT_CONFIGS } from '@/features/effects/constants/effectConfigs';
import { AnchoredPopup, Knob } from '@/features/ui';
import { useLockStore } from '@/features/daw/stores/lockStore';
import { useUserStore } from '@/shared/stores/userStore';
import { useDAWCollaborationContext } from '@/features/daw/contexts/useDAWCollaborationContext';
import { getEffectParamLockId } from '@/features/daw/utils/collaborationLocks';

interface EffectModuleProps {
  effect: EffectInstance;
  chainType: EffectChainType;
  lockScopeId?: string;
  onDragStart?: (effectId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  canReorder?: boolean;
}

export default function EffectModule({
  effect,
  chainType,
  lockScopeId,
  onDragStart,
  onDragEnd,
  isDragging = false,
  canReorder = true,
}: EffectModuleProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const activeParamLocksRef = useRef(new Set<string>());
  
  const {
    removeEffect,
    toggleEffectBypass,
    updateEffectParameter,
    resetEffect,
  } = useEffectsStore();
  const currentUserId = useUserStore((state) => state.userId);
  const lockStoreLookup = useLockStore((state) => state.isLocked);
  const { acquireInteractionLock, releaseInteractionLock } = useDAWCollaborationContext();

  useEffect(() => {
    return () => {
      const locksToRelease = new Set(activeParamLocksRef.current);
      locksToRelease.forEach((lockId) => {
        releaseInteractionLock(lockId);
      });
      activeParamLocksRef.current.clear();
    };
  }, [releaseInteractionLock]);

  const getLockMeta = useCallback(
    (parameterId: string) => {
      if (!lockScopeId) {
        return null;
      }
      const lockId = getEffectParamLockId(lockScopeId, effect.id, parameterId);
      const lock = lockStoreLookup(lockId);
      const lockedByRemote = Boolean(lock && lock.userId !== currentUserId);
      return { lockId, lock, lockedByRemote };
    },
    [lockScopeId, effect.id, lockStoreLookup, currentUserId],
  );

  const handleParamInteractionStart = useCallback(
    (parameterId: string) => {
      if (!lockScopeId) {
        return true;
      }
      const meta = getLockMeta(parameterId);
      if (!meta) {
        return true;
      }
      if (meta.lockedByRemote) {
        return false;
      }
      if (activeParamLocksRef.current.has(meta.lockId)) {
        return true;
      }
      const acquired = acquireInteractionLock(meta.lockId, 'control');
      if (acquired) {
        activeParamLocksRef.current.add(meta.lockId);
      }
      return acquired;
    },
    [acquireInteractionLock, getLockMeta, lockScopeId],
  );

  const handleParamInteractionEnd = useCallback(
    (parameterId: string) => {
      if (!lockScopeId) {
        return;
      }
      const meta = getLockMeta(parameterId);
      if (!meta) {
        return;
      }
      if (activeParamLocksRef.current.delete(meta.lockId)) {
        releaseInteractionLock(meta.lockId);
      }
    },
    [getLockMeta, lockScopeId, releaseInteractionLock],
  );

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
    const lockMeta = getLockMeta(parameter.id);
    const isLockedByRemote = lockMeta?.lockedByRemote ?? false;
    const lockedLabel = isLockedByRemote && lockMeta?.lock ? `🔒 ${lockMeta.lock.username}` : undefined;

    if (parameter.type === 'knob') {
      const knobLockProps = lockScopeId
        ? {
            disabled: isLockedByRemote,
            lockedLabel,
            onInteractionStart: () => handleParamInteractionStart(parameter.id),
            onInteractionEnd: () => handleParamInteractionEnd(parameter.id),
          }
        : {};

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
            {...knobLockProps}
          />
          <span className="text-xs text-center">{parameter.name}</span>
        </div>
      );
    } else {
      // slider type
      const title = isLockedByRemote && lockMeta?.lock ? `Locked by ${lockMeta.lock.username}` : undefined;

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLockedByRemote) {
          return;
        }
        const value = parseFloat(e.target.value);
        if (lockScopeId && handleParamInteractionStart(parameter.id) === false) {
          return;
        }
        handleParameterChange(parameter.id, value);
      };

      return (
        <div key={parameter.id} className="flex flex-col gap-1">
          <label className="text-xs">{parameter.name}</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={parameter.min}
              max={parameter.max}
              step={parameter.step}
              value={parameter.value}
              onChange={handleChange}
              onPointerDown={() => handleParamInteractionStart(parameter.id)}
              onPointerUp={() => handleParamInteractionEnd(parameter.id)}
              onPointerCancel={() => handleParamInteractionEnd(parameter.id)}
              onPointerLeave={() => handleParamInteractionEnd(parameter.id)}
              disabled={isLockedByRemote}
              title={title}
              className={`range range-primary range-sm ${
                isLockedByRemote ? 'cursor-not-allowed opacity-60' : ''
              }`}
            />
            {lockedLabel && (
              <span className="badge badge-outline badge-xs whitespace-nowrap text-[10px]">
                {lockedLabel}
              </span>
            )}
          </div>
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
          effect-module relative flex flex-col items-center p-1 bg-base-200 rounded-lg border
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


