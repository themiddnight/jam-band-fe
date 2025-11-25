import { useCallback, useEffect, useRef, useState, useMemo, memo } from 'react';
import type { EffectInstance, EffectChainType } from '@/features/effects/types';
import { useEffectsStore } from '@/features/effects/stores/effectsStore';
import { AnchoredPopup, Knob } from '@/features/ui';
import { useLockStore } from '@/features/daw/stores/lockStore';
import { useUserStore } from '@/shared/stores/userStore';
import { useDAWCollaborationContext } from '@/features/daw/contexts/useDAWCollaborationContext';
import { getEffectParamLockId } from '@/features/daw/utils/collaborationLocks';
import GraphicEQVisualizer from './GraphicEQVisualizer';

interface GraphicEQModuleProps {
  effect: EffectInstance;
  chainType: EffectChainType;
  lockScopeId?: string;
  audioNode?: AudioNode;
  onDragStart?: (effectId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  canReorder?: boolean;
}

const GraphicEQModule = memo(function GraphicEQModule({
  effect,
  chainType,
  lockScopeId,
  audioNode,
  onDragStart,
  onDragEnd,
  isDragging = false,
  canReorder = true,
}: GraphicEQModuleProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showKnobs, setShowKnobs] = useState(false);
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
    const currentLocksRef = activeParamLocksRef;
    return () => {
      const locksToRelease = new Set(currentLocksRef.current);
      locksToRelease.forEach((lockId) => {
        releaseInteractionLock(lockId);
      });
      currentLocksRef.current.clear();
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

  const handleSettingsClick = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const handleDeleteClick = useCallback(() => {
    removeEffect(chainType, effect.id);
  }, [removeEffect, chainType, effect.id]);

  const handleBypassClick = useCallback(() => {
    toggleEffectBypass(chainType, effect.id);
  }, [toggleEffectBypass, chainType, effect.id]);

  const handleParameterChange = useCallback((parameterId: string, value: number) => {
    updateEffectParameter(chainType, effect.id, parameterId, value);
  }, [updateEffectParameter, chainType, effect.id]);

  const handleResetClick = useCallback(() => {
    resetEffect(chainType, effect.id);
    setShowSettings(false);
  }, [resetEffect, chainType, effect.id]);

  // Memoize parameter lookup map for faster access
  const paramMap = useMemo(() => {
    const map = new Map<string, typeof effect.parameters[0]>();
    effect.parameters.forEach(p => map.set(p.name, p));
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect.parameters]);

  const getParam = useCallback((name: string) => paramMap.get(name), [paramMap]);

  // Memoize parameters object to prevent unnecessary recalculations
  const parameters = useMemo(() => ({
    lowCut: getParam('Low Cut')?.value || 20,
    lowCutQ: getParam('Low Cut Q')?.value || 0.707,
    p1Freq: getParam('P1 Freq')?.value || 100,
    p2Freq: getParam('P2 Freq')?.value || 500,
    p3Freq: getParam('P3 Freq')?.value || 2000,
    p4Freq: getParam('P4 Freq')?.value || 5000,
    p5Freq: getParam('P5 Freq')?.value || 10000,
    highCut: getParam('High Cut')?.value || 20000,
    highCutQ: getParam('High Cut Q')?.value || 0.707,
    p1Q: getParam('P1 Q')?.value || 1,
    p2Q: getParam('P2 Q')?.value || 1,
    p3Q: getParam('P3 Q')?.value || 1,
    p4Q: getParam('P4 Q')?.value || 1,
    p5Q: getParam('P5 Q')?.value || 1,
    p1Vol: getParam('P1 Vol')?.value || 0,
    p2Vol: getParam('P2 Vol')?.value || 0,
    p3Vol: getParam('P3 Vol')?.value || 0,
    p4Vol: getParam('P4 Vol')?.value || 0,
    p5Vol: getParam('P5 Vol')?.value || 0,
  }), [getParam]);

  const renderKnob = useCallback((parameter: typeof effect.parameters[0]) => {
    const lockMeta = getLockMeta(parameter.id);
    const isLockedByRemote = lockMeta?.lockedByRemote ?? false;
    const lockedLabel = isLockedByRemote && lockMeta?.lock ? `🔒 ${lockMeta.lock.username}` : undefined;

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
          size={45}
          curve={parameter.curve}
          tooltipFormat={(val) => {
            if (parameter.unit) {
              return `${val.toFixed(1)}${parameter.unit}`;
            }
            return val.toFixed(2);
          }}
          color="primary"
          {...knobLockProps}
        />
        <span className="text-[10px] text-center">{parameter.name}</span>
      </div>
    );
  }, [effect, getLockMeta, lockScopeId, handleParamInteractionStart, handleParamInteractionEnd, handleParameterChange]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!canReorder) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', effect.id);
    onDragStart?.(effect.id);
  }, [canReorder, effect.id, onDragStart]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <>
      <div
        draggable={canReorder}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`
          effect-module relative flex flex-col items-center p-1 bg-base-200 rounded-lg border
          ${effect.bypassed ? 'border-base-300 opacity-60' : 'border-primary'}
          ${isDragging ? 'opacity-50' : ''}
          ${canReorder ? 'cursor-move' : ''}
          transition-all duration-150
        `}
      >
        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          {/* Bypass Button */}
          <button
            onClick={handleBypassClick}
            className={`btn btn-xs ${effect.bypassed ? 'btn-ghost text-base-content/50' : 'btn-success'}`}
            title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
          >
            {effect.bypassed ? '⏸️' : '▶️'}
          </button>

          <span className="text-xs">📊 {effect.name}</span>

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

      {/* Settings Popup with Visualizer and Controls */}
      <AnchoredPopup
        open={showSettings}
        onClose={() => setShowSettings(false)}
        anchorRef={settingsButtonRef}
        placement="bottom"
        className="w-[650px]"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              📊 {effect.name} Settings
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKnobs(!showKnobs)}
                className={`btn btn-xs ${showKnobs ? 'btn-primary' : 'btn-ghost'}`}
                title={showKnobs ? 'Hide knobs' : 'Show knobs'}
              >
                🎛️
              </button>
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

          {/* Visualizer */}
          <div className="mb-4">
            <GraphicEQVisualizer
              effectId={effect.id}
              audioNode={audioNode}
              parameters={parameters}
              onParameterChange={(paramName, value) => {
                const param = effect.parameters.find(p => p.name === paramName);
                if (param) {
                  handleParameterChange(param.id, value);
                }
              }}
            />
          </div>

          {/* Knobs Layout */}
          {showKnobs && (
            <div className="flex flex-col gap-3">
              {/* Row 1: Frequency knobs */}
              <div className="flex justify-around items-center gap-1">
                {getParam('Low Cut') ? renderKnob(getParam('Low Cut')!) : <div className="w-[45px]"></div>}
                {getParam('P1 Freq') ? renderKnob(getParam('P1 Freq')!) : <div className="w-[45px]"></div>}
                {getParam('P2 Freq') ? renderKnob(getParam('P2 Freq')!) : <div className="w-[45px]"></div>}
                {getParam('P3 Freq') ? renderKnob(getParam('P3 Freq')!) : <div className="w-[45px]"></div>}
                {getParam('P4 Freq') ? renderKnob(getParam('P4 Freq')!) : <div className="w-[45px]"></div>}
                {getParam('P5 Freq') ? renderKnob(getParam('P5 Freq')!) : <div className="w-[45px]"></div>}
                {getParam('High Cut') ? renderKnob(getParam('High Cut')!) : <div className="w-[45px]"></div>}
              </div>

              {/* Row 2: Q knobs */}
              <div className="flex justify-around items-center gap-1">
                {getParam('Low Cut Q') ? renderKnob(getParam('Low Cut Q')!) : <div className="w-[45px]"></div>}
                {getParam('P1 Q') ? renderKnob(getParam('P1 Q')!) : <div className="w-[45px]"></div>}
                {getParam('P2 Q') ? renderKnob(getParam('P2 Q')!) : <div className="w-[45px]"></div>}
                {getParam('P3 Q') ? renderKnob(getParam('P3 Q')!) : <div className="w-[45px]"></div>}
                {getParam('P4 Q') ? renderKnob(getParam('P4 Q')!) : <div className="w-[45px]"></div>}
                {getParam('P5 Q') ? renderKnob(getParam('P5 Q')!) : <div className="w-[45px]"></div>}
                {getParam('High Cut Q') ? renderKnob(getParam('High Cut Q')!) : <div className="w-[45px]"></div>}
              </div>

              {/* Row 3: Volume knobs */}
              <div className="flex justify-around items-center gap-1">
                <div className="w-[45px]"></div>
                {getParam('P1 Vol') ? renderKnob(getParam('P1 Vol')!) : <div className="w-[45px]"></div>}
                {getParam('P2 Vol') ? renderKnob(getParam('P2 Vol')!) : <div className="w-[45px]"></div>}
                {getParam('P3 Vol') ? renderKnob(getParam('P3 Vol')!) : <div className="w-[45px]"></div>}
                {getParam('P4 Vol') ? renderKnob(getParam('P4 Vol')!) : <div className="w-[45px]"></div>}
                {getParam('P5 Vol') ? renderKnob(getParam('P5 Vol')!) : <div className="w-[45px]"></div>}
                <div className="w-[45px]"></div>
              </div>
            </div>
          )}

          <div className="text-xs text-base-content/60 mt-4 pt-3 border-t border-base-300">
            <p>
              <strong>Freq:</strong> Center frequency • <strong>Q:</strong> Bandwidth (higher = narrower) • <strong>Vol:</strong> Gain/cut in dB
            </p>
            {(!getParam('Low Cut Q') || !getParam('High Cut Q')) && (
              <p className="text-warning mt-2">
                ⚠️ This EQ is missing new parameters. Delete and re-add it to get Low/High Cut Q controls.
              </p>
            )}
          </div>
        </div>
      </AnchoredPopup>
    </>
  );
});

export default GraphicEQModule;
