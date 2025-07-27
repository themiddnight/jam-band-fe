import { lazy, Suspense } from 'react';

// Lazy load heavy components
const LazyKeyboard = lazy(() => import('./Keyboard'));
const LazyGuitar = lazy(() => import('./Guitar'));
const LazyBass = lazy(() => import('./Bass'));
const LazyDrumpad = lazy(() => import('./Drumpad'));
const LazyDrumset = lazy(() => import('./Drumset'));
const LazySynthControls = lazy(() => 
  import('./Synthesizer/SynthControls').then(module => ({ default: module.SynthControls }))
);

// Loading component
const ComponentLoader = ({ name }: { name: string }) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex items-center space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      <span className="text-gray-600">Loading {name}...</span>
    </div>
  </div>
);

// Wrapped lazy components with suspense
export const LazyKeyboardWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Keyboard" />}>
    <LazyKeyboard {...props} />
  </Suspense>
);

export const LazyGuitarWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Guitar" />}>
    <LazyGuitar {...props} />
  </Suspense>
);

export const LazyBassWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Bass" />}>
    <LazyBass {...props} />
  </Suspense>
);

export const LazyDrumpadWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Drumpad" />}>
    <LazyDrumpad {...props} />
  </Suspense>
);

export const LazyDrumsetWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Drumset" />}>
    <LazyDrumset {...props} />
  </Suspense>
);

export const LazySynthControlsWrapper = (props: any) => (
  <Suspense fallback={<ComponentLoader name="Synthesizer Controls" />}>
    <LazySynthControls {...props} />
  </Suspense>
); 