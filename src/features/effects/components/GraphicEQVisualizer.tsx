import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text } from 'react-konva';
import * as Tone from 'tone';

interface GraphicEQVisualizerProps {
  effectId: string;
  audioNode?: AudioNode;
  parameters: {
    lowCut: number;
    lowCutQ: number;
    p1Freq: number;
    p2Freq: number;
    p3Freq: number;
    p4Freq: number;
    p5Freq: number;
    highCut: number;
    highCutQ: number;
    p1Q: number;
    p2Q: number;
    p3Q: number;
    p4Q: number;
    p5Q: number;
    p1Vol: number;
    p2Vol: number;
    p3Vol: number;
    p4Vol: number;
    p5Vol: number;
  };
  onParameterChange?: (param: string, value: number) => void;
}

export default function GraphicEQVisualizer({
  audioNode,
  parameters,
  onParameterChange,
}: GraphicEQVisualizerProps) {
  const [waveformData, setWaveformData] = useState<Float32Array>(() => new Float32Array(512));
  const analyserRef = useRef<Tone.Waveform | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastUpdateTimeRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  
  const width = 600;
  const height = 300;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Throttle waveform updates to 30fps (every ~33ms) instead of 60fps
  const WAVEFORM_UPDATE_INTERVAL = 33;

  useEffect(() => {
    if (!audioNode) return;

    // Create Tone.js Waveform analyzer (size parameter)
    const waveform = new Tone.Waveform(512);
    
    try {
      // Connect audio node to analyzer
      if (audioNode instanceof AudioNode) {
        audioNode.connect(waveform.input as any);
      }
      analyserRef.current = waveform;

      // Throttled animation loop for real-time visualization
      const updateWaveform = (timestamp: number) => {
        if (!isVisibleRef.current) {
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
          return;
        }

        // Throttle updates to reduce CPU usage
        if (timestamp - lastUpdateTimeRef.current >= WAVEFORM_UPDATE_INTERVAL) {
          if (analyserRef.current) {
            const data = analyserRef.current.getValue();
            setWaveformData(new Float32Array(data));
          }
          lastUpdateTimeRef.current = timestamp;
        }
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    } catch (error) {
      console.warn('[GraphicEQ] Failed to connect analyzer:', error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserRef.current) {
        try {
          audioNode.disconnect(analyserRef.current.input as any);
          analyserRef.current.dispose();
        } catch {
          // ignore
        }
      }
    };
  }, [audioNode]);

  // Memoize conversion functions
  const freqToX = useCallback((freq: number): number => {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return padding + ((logFreq - logMin) / (logMax - logMin)) * graphWidth;
  }, [graphWidth, padding]);

  const dbToY = useCallback((db: number): number => {
    const minDb = -24;
    const maxDb = 24;
    return padding + graphHeight - ((db - minDb) / (maxDb - minDb)) * graphHeight;
  }, [graphHeight, padding]);

  // Memoize response curve calculation - only recalculate when parameters change
  const responseCurve = useMemo((): number[] => {
    const points: number[] = [];
    const numPoints = 200;
    
    // Pre-calculate band data to avoid repeated object creation
    const bands = [
      { freq: parameters.p1Freq, q: parameters.p1Q, gain: parameters.p1Vol },
      { freq: parameters.p2Freq, q: parameters.p2Q, gain: parameters.p2Vol },
      { freq: parameters.p3Freq, q: parameters.p3Q, gain: parameters.p3Vol },
      { freq: parameters.p4Freq, q: parameters.p4Q, gain: parameters.p4Vol },
      { freq: parameters.p5Freq, q: parameters.p5Q, gain: parameters.p5Vol },
    ];
    
    for (let i = 0; i <= numPoints; i++) {
      const x = padding + (i / numPoints) * graphWidth;
      const freq = Math.pow(10, 1.3 + (i / numPoints) * 3); // 20Hz to 20kHz log scale
      
      let totalDb = 0;
      
      // Low cut filter effect
      if (freq < parameters.lowCut) {
        totalDb -= (parameters.lowCut - freq) / 50;
      }
      
      // High cut filter effect
      if (freq > parameters.highCut) {
        totalDb -= (freq - parameters.highCut) / 1000;
      }
      
      // Add each band's contribution
      for (const band of bands) {
        const bandwidth = band.freq / band.q;
        const distance = Math.abs(freq - band.freq);
        const influence = Math.exp(-Math.pow(distance / bandwidth, 2));
        totalDb += band.gain * influence;
      }
      
      points.push(x, dbToY(Math.max(-24, Math.min(24, totalDb))));
    }
    
    return points;
  }, [parameters, padding, graphWidth, dbToY]);

  // Memoize waveform points - only recalculate when waveform data changes
  const waveformPoints = useMemo((): number[] => {
    const points: number[] = [];
    const step = Math.floor(waveformData.length / 100);
    
    for (let i = 0; i < waveformData.length; i += step) {
      const x = padding + (i / waveformData.length) * graphWidth;
      const amplitude = waveformData[i] || 0;
      const y = padding + graphHeight / 2 + amplitude * (graphHeight / 4);
      points.push(x, y);
    }
    
    return points;
  }, [waveformData, padding, graphWidth, graphHeight]);

  return (
    <div className="graphic-eq-visualizer">
      <Stage width={width} height={height}>
        <Layer>
          {/* Background */}
          <Line
            points={[padding, padding, padding, height - padding]}
            stroke="#444"
            strokeWidth={2}
          />
          <Line
            points={[padding, height - padding, width - padding, height - padding]}
            stroke="#444"
            strokeWidth={2}
          />
          
          {/* Grid lines */}
          {[-24, -12, 0, 12, 24].map(db => (
            <Line
              key={`grid-${db}`}
              points={[padding, dbToY(db), width - padding, dbToY(db)]}
              stroke="#333"
              strokeWidth={1}
              dash={[5, 5]}
            />
          ))}
          
          {/* Frequency markers */}
          {[100, 1000, 10000].map(freq => (
            <Line
              key={`freq-${freq}`}
              points={[freqToX(freq), padding, freqToX(freq), height - padding]}
              stroke="#333"
              strokeWidth={1}
              dash={[5, 5]}
            />
          ))}
          
          {/* Real-time waveform (faint background) */}
          <Line
            points={waveformPoints}
            stroke="rgba(100, 200, 255, 0.3)"
            strokeWidth={1}
            tension={0.3}
          />
          
          {/* Frequency response curve */}
          <Line
            points={responseCurve}
            stroke="#00ff88"
            strokeWidth={3}
            tension={0.4}
          />
          
          {/* EQ band points - draggable */}
          {useMemo(() => [
            {
              freq: parameters.p1Freq,
              vol: parameters.p1Vol,
              color: '#ff6b6b',
              freqParam: 'P1 Freq',
              volParam: 'P1 Vol',
              label: 'P1',
            },
            {
              freq: parameters.p2Freq,
              vol: parameters.p2Vol,
              color: '#ffd93d',
              freqParam: 'P2 Freq',
              volParam: 'P2 Vol',
              label: 'P2',
            },
            {
              freq: parameters.p3Freq,
              vol: parameters.p3Vol,
              color: '#6bcf7f',
              freqParam: 'P3 Freq',
              volParam: 'P3 Vol',
              label: 'P3',
            },
            {
              freq: parameters.p4Freq,
              vol: parameters.p4Vol,
              color: '#4d96ff',
              freqParam: 'P4 Freq',
              volParam: 'P4 Vol',
              label: 'P4',
            },
            {
              freq: parameters.p5Freq,
              vol: parameters.p5Vol,
              color: '#c77dff',
              freqParam: 'P5 Freq',
              volParam: 'P5 Vol',
              label: 'P5',
            },
          ], [parameters]).map((band, idx) => {
            const handleDrag = (e: any) => {
              if (!onParameterChange) return;
              
              const x = e.target.x();
              const y = e.target.y();
              
              // Convert x position back to frequency (logarithmic)
              const minFreq = 20;
              const maxFreq = 20000;
              const logMin = Math.log10(minFreq);
              const logMax = Math.log10(maxFreq);
              const normalizedX = (x - padding) / graphWidth;
              const logFreq = logMin + normalizedX * (logMax - logMin);
              const newFreq = Math.pow(10, logFreq);
              const clampedFreq = Math.max(minFreq, Math.min(maxFreq, newFreq));
              
              // Convert y position back to dB
              const minDb = -24;
              const maxDb = 24;
              const normalizedY = 1 - (y - padding) / graphHeight;
              const newDb = minDb + normalizedY * (maxDb - minDb);
              const clampedDb = Math.max(minDb, Math.min(maxDb, newDb));
              
              // Update both frequency and volume
              onParameterChange(band.freqParam, clampedFreq);
              onParameterChange(band.volParam, clampedDb);
            };
            
            const pointX = freqToX(band.freq);
            const pointY = dbToY(band.vol);

            return (
              <>
                <Circle
                  key={`band-${idx}`}
                  x={pointX}
                  y={pointY}
                  radius={10}
                  fill={band.color}
                  stroke="#fff"
                  strokeWidth={2}
                  shadowBlur={10}
                  shadowColor={band.color}
                  draggable={!!onParameterChange}
                  dragBoundFunc={(pos) => {
                    // Constrain dragging to graph bounds
                    return {
                      x: Math.max(padding, Math.min(width - padding, pos.x)),
                      y: Math.max(padding, Math.min(height - padding, pos.y)),
                    };
                  }}
                  onDragMove={handleDrag}
                  onMouseEnter={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'pointer';
                  }}
                  onMouseLeave={(e) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'default';
                  }}
                />
                {/* Label for band point */}
                <Text
                  key={`band-label-${idx}`}
                  x={pointX - 10}
                  y={pointY - 25}
                  text={band.label}
                  fontSize={11}
                  fontStyle="bold"
                  fill={band.color}
                  stroke="#000"
                  strokeWidth={0.5}
                />
              </>
            );
          })}
          
          {/* Cut filter markers - draggable horizontally */}
          {/* Low Cut */}
          <Circle
            x={freqToX(parameters.lowCut)}
            y={height - padding}
            radius={8}
            fill="#ff4444"
            stroke="#fff"
            strokeWidth={2}
            draggable={!!onParameterChange}
            dragBoundFunc={(pos) => {
              return {
                x: Math.max(padding, Math.min(width - padding, pos.x)),
                y: height - padding, // Lock to bottom
              };
            }}
            onDragMove={(e) => {
              if (!onParameterChange) return;
              const x = e.target.x();
              const minFreq = 20;
              const maxFreq = 500; // Low cut max
              const logMin = Math.log10(minFreq);
              const logMax = Math.log10(maxFreq);
              const normalizedX = (x - padding) / graphWidth;
              const logFreq = logMin + normalizedX * (logMax - logMin);
              const newFreq = Math.pow(10, logFreq);
              const clampedFreq = Math.max(minFreq, Math.min(maxFreq, newFreq));
              onParameterChange('Low Cut', clampedFreq);
            }}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'ew-resize';
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
          <Text
            x={freqToX(parameters.lowCut) - 15}
            y={height - padding + 12}
            text="Low"
            fontSize={10}
            fontStyle="bold"
            fill="#ff4444"
            stroke="#000"
            strokeWidth={0.5}
          />

          {/* High Cut */}
          <Circle
            x={freqToX(parameters.highCut)}
            y={height - padding}
            radius={8}
            fill="#ff4444"
            stroke="#fff"
            strokeWidth={2}
            draggable={!!onParameterChange}
            dragBoundFunc={(pos) => {
              return {
                x: Math.max(padding, Math.min(width - padding, pos.x)),
                y: height - padding, // Lock to bottom
              };
            }}
            onDragMove={(e) => {
              if (!onParameterChange) return;
              const x = e.target.x();
              const minFreq = 1000; // High cut min
              const maxFreq = 20000;
              const logMin = Math.log10(minFreq);
              const logMax = Math.log10(maxFreq);
              const normalizedX = (x - padding) / graphWidth;
              const logFreq = logMin + normalizedX * (logMax - logMin);
              const newFreq = Math.pow(10, logFreq);
              const clampedFreq = Math.max(minFreq, Math.min(maxFreq, newFreq));
              onParameterChange('High Cut', clampedFreq);
            }}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'ew-resize';
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
          <Text
            x={freqToX(parameters.highCut) - 15}
            y={height - padding + 12}
            text="High"
            fontSize={10}
            fontStyle="bold"
            fill="#ff4444"
            stroke="#000"
            strokeWidth={0.5}
          />
          
          {/* Labels */}
          <Text
            x={5}
            y={padding - 20}
            text="+24dB"
            fontSize={12}
            fill="#888"
          />
          <Text
            x={5}
            y={height / 2 - 10}
            text="0dB"
            fontSize={12}
            fill="#888"
          />
          <Text
            x={5}
            y={height - padding - 10}
            text="-24dB"
            fontSize={12}
            fill="#888"
          />
          
          <Text
            x={freqToX(100) - 15}
            y={height - padding + 10}
            text="100Hz"
            fontSize={10}
            fill="#888"
          />
          <Text
            x={freqToX(1000) - 20}
            y={height - padding + 10}
            text="1kHz"
            fontSize={10}
            fill="#888"
          />
          <Text
            x={freqToX(10000) - 25}
            y={height - padding + 10}
            text="10kHz"
            fontSize={10}
            fill="#888"
          />
        </Layer>
      </Stage>
    </div>
  );
}
