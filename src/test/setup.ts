import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock AudioContext for Web Audio API tests
// Create a proper AudioParam mock that Tone.js will accept
class MockAudioParam implements AudioParam {
  value = 0;
  defaultValue = 0;
  minValue = 0;
  maxValue = 1;
  automationRate: AutomationRate = 'a-rate';

  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  setTargetAtTime = vi.fn().mockReturnThis();
  setValueCurveAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
  cancelAndHoldAtTime = vi.fn().mockReturnThis();
  
  // Make it look like a real AudioParam
  get [Symbol.toStringTag]() {
    return 'AudioParam';
  }
}

// Create a global AudioParam constructor if it doesn't exist
if (typeof AudioParam === 'undefined') {
  (global as any).AudioParam = MockAudioParam;
} else {
  // If AudioParam exists, set up the prototype chain properly
  // Only do this if they're not the same to avoid cyclic reference
  if (MockAudioParam !== AudioParam) {
    Object.setPrototypeOf(MockAudioParam.prototype, AudioParam.prototype);
  }
}

class MockAudioNode {
  context: any;
  numberOfInputs = 1;
  numberOfOutputs = 1;
  channelCount = 2;
  channelCountMode = 'max' as any;
  channelInterpretation = 'speakers' as any;

  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn().mockReturnThis();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

class MockAudioContext {
  state = 'running';
  sampleRate = 44100;
  currentTime = 0;
  baseLatency = 0;
  outputLatency = 0;
  
  listener = {
    positionX: new MockAudioParam(),
    positionY: new MockAudioParam(),
    positionZ: new MockAudioParam(),
    forwardX: new MockAudioParam(),
    forwardY: new MockAudioParam(),
    forwardZ: new MockAudioParam(),
    upX: new MockAudioParam(),
    upY: new MockAudioParam(),
    upZ: new MockAudioParam(),
  };
  
  destination = Object.assign(new MockAudioNode(), {
    maxChannelCount: 2,
  });

  createGain() {
    return Object.assign(new MockAudioNode(), {
      gain: new MockAudioParam(),
    });
  }

  createOscillator() {
    return Object.assign(new MockAudioNode(), {
      type: 'sine',
      frequency: new MockAudioParam(),
      detune: new MockAudioParam(),
      start: vi.fn(),
      stop: vi.fn(),
      setPeriodicWave: vi.fn(),
    });
  }

  createBiquadFilter() {
    return Object.assign(new MockAudioNode(), {
      type: 'lowpass',
      frequency: new MockAudioParam(),
      detune: new MockAudioParam(),
      Q: new MockAudioParam(),
      gain: new MockAudioParam(),
      getFrequencyResponse: vi.fn(),
    });
  }

  createDynamicsCompressor() {
    return Object.assign(new MockAudioNode(), {
      threshold: new MockAudioParam(),
      knee: new MockAudioParam(),
      ratio: new MockAudioParam(),
      attack: new MockAudioParam(),
      release: new MockAudioParam(),
      reduction: 0,
    });
  }

  createDelay() {
    return Object.assign(new MockAudioNode(), {
      delayTime: new MockAudioParam(),
    });
  }

  createWaveShaper() {
    return Object.assign(new MockAudioNode(), {
      curve: null,
      oversample: 'none',
    });
  }

  createChannelSplitter(numberOfOutputs = 6) {
    return Object.assign(new MockAudioNode(), {
      numberOfOutputs,
    });
  }

  createChannelMerger(numberOfInputs = 6) {
    return Object.assign(new MockAudioNode(), {
      numberOfInputs,
    });
  }

  createConvolver() {
    return Object.assign(new MockAudioNode(), {
      buffer: null,
      normalize: true,
    });
  }

  createStereoPanner() {
    return Object.assign(new MockAudioNode(), {
      pan: new MockAudioParam(),
    });
  }

  createAnalyser() {
    return Object.assign(new MockAudioNode(), {
      fftSize: 2048,
      frequencyBinCount: 1024,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      getFloatFrequencyData: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
    });
  }

  createBufferSource() {
    return Object.assign(new MockAudioNode(), {
      buffer: null,
      playbackRate: new MockAudioParam(),
      detune: new MockAudioParam(),
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      start: vi.fn(),
      stop: vi.fn(),
    });
  }

  createConstantSource() {
    return Object.assign(new MockAudioNode(), {
      offset: new MockAudioParam(),
      start: vi.fn(),
      stop: vi.fn(),
    });
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    };
  }

  decodeAudioData() {
    return Promise.resolve(this.createBuffer(2, 44100, 44100));
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  createMediaElementSource = vi.fn();
  createMediaStreamSource = vi.fn();
  createMediaStreamDestination = vi.fn();
  createPeriodicWave = vi.fn();
  createScriptProcessor = vi.fn();
  
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

global.AudioContext = MockAudioContext as any;
(global as any).webkitAudioContext = MockAudioContext;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Lightweight localStorage polyfill for environments without DOM storage or with opaque origins
const shouldPolyfillLocalStorage = (() => {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return false;
  } catch {
    return true;
  }
})();

if (shouldPolyfillLocalStorage) {
  const storage = new Map<string, string>();

  const localStorageMock = {
    get length() {
      return storage.size;
    },
    clear: () => storage.clear(),
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
  } satisfies Storage;

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}