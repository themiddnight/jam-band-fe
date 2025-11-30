import * as Tone from "tone";
import type { AudioEffect } from "../utils/effectsArchitecture";
import { EffectsFactory, EffectType } from "../utils/effectsArchitecture";
import type { EffectInstance } from "@/features/effects/types";
import { EFFECT_TYPE_MAP, PARAMETER_MAP } from "@/features/effects/services/effectMappings";

interface AudioInputEffectMapping {
  id: string;
  effect: AudioEffect;
}

/**
 * Manages the audio input effect chain so microphone audio can be processed locally
 * before being sent to WebRTC peers or the local monitor mix.
 */
class AudioInputEffectsManager {
  private context: AudioContext | null = null;
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private effectChain: AudioInputEffectMapping[] = [];
  private pendingEffects: EffectInstance[] = [];
  private currentSource: AudioNode | null = null;

  async initialize(context: AudioContext): Promise<void> {
    if (this.context === context && this.inputNode && this.outputNode) {
      return;
    }

    // If context changes, cleanup previous graph
    if (this.context && this.context !== context) {
      this.reset();
    }

    this.context = context;

    // Ensure effect factory is ready for this context
    await EffectsFactory.initialize(context);

    if (!this.inputNode) {
      this.inputNode = context.createGain();
      this.inputNode.gain.value = 1;
    }

    if (!this.outputNode) {
      this.outputNode = context.createGain();
      this.outputNode.gain.value = 1;
    }

    this.rebuildChain();

    if (this.pendingEffects.length > 0) {
      this.syncEffects(this.pendingEffects);
    }
  }

  getInputNode(): GainNode {
    if (!this.inputNode) {
      throw new Error("AudioInputEffectsManager is not initialized");
    }
    return this.inputNode;
  }

  getOutputNode(): GainNode {
    if (!this.outputNode) {
      throw new Error("AudioInputEffectsManager is not initialized");
    }
    return this.outputNode;
  }

  attachSource(sourceNode: AudioNode): void {
    if (!this.inputNode) return;

    this.detachSource();

    try {
      sourceNode.connect(this.inputNode);
      this.currentSource = sourceNode;
    } catch (error) {
      console.warn("Failed to attach audio input source to effects chain", error);
    }
  }

  detachSource(): void {
    if (!this.currentSource || !this.inputNode) {
      return;
    }

    try {
      this.currentSource.disconnect(this.inputNode);
    } catch (error) {
      console.warn("Failed to detach audio input source from effects chain", error);
    }

    this.currentSource = null;
  }

  /**
   * Synchronize the audio input effects chain with the UI store state.
   */
  syncEffects(effects: EffectInstance[]): void {
    this.pendingEffects = [...effects];

    if (!this.context || !this.inputNode || !this.outputNode) {
      return;
    }

    const sortedEffects = [...effects].sort((a, b) => a.order - b.order);
    const remainingIds = new Set(this.effectChain.map((item) => item.id));
    const updatedChain: AudioInputEffectMapping[] = [];

    for (const effectInstance of sortedEffects) {
      const existingMapping = this.effectChain.find(
        (mapping) => mapping.id === effectInstance.id,
      );

      let audioEffect: AudioEffect | null = existingMapping?.effect ?? null;

      if (!audioEffect) {
        const effectType = this.resolveEffectType(effectInstance.type);
        if (!effectType) {
          continue;
        }

        audioEffect = EffectsFactory.createEffect(effectType, effectInstance.id);
        if (!audioEffect) {
          console.warn("Unable to instantiate audio effect", effectInstance.type);
          continue;
        }
      } else {
        remainingIds.delete(effectInstance.id);
      }

      this.applyParameters(effectInstance, audioEffect);

      if (effectInstance.bypassed) {
        audioEffect.disable();
      } else {
        audioEffect.enable();
      }

      updatedChain.push({
        id: effectInstance.id,
        effect: audioEffect,
      });
    }

    // Release any effects that are no longer in the chain
    for (const removeId of remainingIds) {
      const mapping = this.effectChain.find((item) => item.id === removeId);
      if (mapping) {
        EffectsFactory.releaseEffect(mapping.effect);
      }
    }

    this.effectChain = updatedChain;
    this.rebuildChain();
  }

  reset(): void {
    this.detachSource();

    for (const mapping of this.effectChain) {
      EffectsFactory.releaseEffect(mapping.effect);
    }

    this.effectChain = [];
    this.pendingEffects = [];

    if (this.inputNode) {
      try {
        this.inputNode.disconnect();
      } catch {
        /* noop */
      }
    }

    if (this.outputNode) {
      try {
        this.outputNode.disconnect();
      } catch {
        /* noop */
      }
    }

    this.inputNode = null;
    this.outputNode = null;
    this.currentSource = null;
    this.context = null;
  }

  private resolveEffectType(effectType: string): EffectType | null {
    const mappedType = EFFECT_TYPE_MAP[effectType];
    return mappedType ?? null;
  }

  private applyParameters(effectInstance: EffectInstance, audioEffect: AudioEffect): void {
    const parameterMap = PARAMETER_MAP[effectInstance.type] || {};

    for (const parameter of effectInstance.parameters) {
      const normalizedName = parameter.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const mappedName = parameterMap[normalizedName] ?? parameter.name;

      try {
        let value = parameter.value;
        if (mappedName === "wetLevel" && parameter.max === 100) {
          value = parameter.value / 100;
        }
        audioEffect.setParameter(mappedName, value);
      } catch (error) {
        console.warn(
          `Failed to set audio input effect parameter ${parameter.name} (${mappedName})`,
          error,
        );
      }
    }
  }

  private rebuildChain(): void {
    if (!this.inputNode || !this.outputNode) {
      return;
    }

    try {
      this.inputNode.disconnect();
    } catch {
      /* ignore */
    }

    if (this.effectChain.length === 0) {
      try {
        (Tone as any).connect?.(this.inputNode, this.outputNode);
      } catch {
        this.inputNode.connect(this.outputNode);
      }
      return;
    }

    let currentNode: AudioNode = this.inputNode;

    for (const mapping of this.effectChain) {
      try {
        (Tone as any).connect?.(currentNode, mapping.effect.inputNode);
        currentNode = mapping.effect.outputNode;
      } catch (error) {
        console.warn("Failed to connect audio input effect in chain", error);
      }
    }

    try {
      (Tone as any).connect?.(currentNode, this.outputNode);
    } catch (error) {
      console.warn("Failed to connect audio input effect output to destination", error);
      currentNode.connect(this.outputNode);
    }
  }
}

export const audioInputEffectsManager = new AudioInputEffectsManager();
