# Jam Band Frontend

A real-time collaborative music-making web application built with React, TypeScript, and modern web technologies. Create music together with friends in virtual jam sessions using various virtual instruments.

## 🎵 Features

- **Virtual Instruments**: Guitar, Bass, Keyboard, Drums, Synthesizer, and more
- **Real-time Collaboration**: Join rooms and jam with other musicians
- **WebRTC Voice Chat**: Communicate with band members during sessions
- **Synchronized Metronome**: Keep time together with room-wide metronome synchronization
- **MIDI Controller Support**: Use external MIDI devices for enhanced control
- **Responsive Design**: Works on desktop and mobile devices
- **PWA Support**: Install as a progressive web app for offline access
- **Scale & Chord Support**: Built-in music theory helpers
- **Preset Management**: Save and load instrument configurations

## � What's new (Aug 2025)

- Network diagnostics and reliability improvements: frontend now measures round-trip ping and RTC latency and surfaces lightweight diagnostics in the UI.
- Socket optimizations: message batching, note-event deduplication, and connection pooling reduce network chatter and improve responsiveness.
- WebRTC reliability: health checks, automatic reconnection with backoff, ICE candidate buffering to avoid race conditions, and heartbeat/grace-period handling for smoother voice sessions.
- State/store refactor: instrument stores were consolidated into a small `createInstrumentStore` factory (Zustand + persist) and the preset manager was rewritten to a reducer-based implementation for safer import/export behavior.
- **Separated Audio Contexts**: Dedicated audio contexts for instruments and WebRTC to eliminate performance competition and improve voice quality during musical collaboration.
- **Performance Optimization**: Dynamic polyphony reduction and CPU throttling when WebRTC is active to maintain smooth voice chat.
- **Smart Resource Management**: Automatic context suspension/resumption and optimized sample rates (44.1kHz for instruments, 48kHz for WebRTC).
- **Synchronized Metronome System**: Room-wide metronome with real-time BPM synchronization, tap tempo functionality, and personal volume/mute controls.
- Network diagnostics and reliability improvements: frontend now measures round-trip ping and RTC latency and surfaces lightweight diagnostics in the UI.
- Socket optimizations: message batching, note-event deduplication, and connection pooling reduce network chatter and improve responsiveness.
- WebRTC reliability: health checks, automatic reconnection with backoff, ICE candidate buffering to avoid race conditions, and heartbeat/grace-period handling for smoother voice sessions.
- State/store refactor: instrument stores were consolidated into a small `createInstrumentStore` factory (Zustand + persist) and the preset manager was rewritten to a reducer-based implementation for safer import/export behavior.A real-time collaborative music-making web application built with React, TypeScript, and modern web technologies. Create music together with friends in virtual jam sessions using various virtual instruments.

## �🏗️ System Architecture

The Jam Band frontend is built with a modular, feature-based architecture designed for real-time audio collaboration:

```mermaid
graph TB
    subgraph "Frontend Application"
        A[User Browser] --> B[React App]
        B --> C[Router]
        C --> D[Lobby Page]
        C --> E[Room Page]
        C --> F[Invite Page]
        
        subgraph "Core Features"
            G[Audio Engine]
            H[Instrument Manager]
            I[WebRTC Voice]
            J[Socket.IO Client]
            K[Room Management]
            L[Metronome System]
        end
        
        E --> G
        E --> H
        E --> I
        E --> J
        E --> K
        E --> L
        
        subgraph "Audio Stack"
            L[Web Audio API]
            M[Tone.js Synthesizers]
            N[Smplr Instruments]
            O[MIDI Controller Support]
            P[Separated Audio Contexts]
            Q[Performance Optimization]
        end
        
        G --> L
        G --> M
        G --> N
        G --> O
        G --> P
        G --> Q
        G --> N
        G --> O
        G --> P
        
        subgraph "State Management"
            Q[Zustand Stores]
            R[TanStack Query]
            S[Local Storage]
        end
        
        B --> Q
        B --> R
        B --> S
    end
    
    subgraph "Backend Services"
        T[Socket.IO Server]
        U[Room Service]
        V[WebRTC Signaling]
        W[Chat Service]
        X[Metronome Service]
    end
    
    J <--> T
    I <--> V
    K <--> U
    L <--> X
    
    subgraph "External Services"
        Y[STUN Servers]
        Z[Audio Sample CDNs]
    end
    
    I <--> Y
    N --> Z
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style G fill:#fff3e0
    style H fill:#fff3e0
    style I fill:#e8f5e8
    style L fill:#fff8e1
    style T fill:#fce4ec
```

## 🎼 Audio Engine & Instrument System

### Architecture Overview

The audio engine is the heart of the application, managing instrument instances, audio processing, and real-time synchronization:

```mermaid
sequenceDiagram
    participant U as User
    participant AC as Audio Context
    participant IM as Instrument Manager
    participant IE as Instrument Engine
    participant S as Socket
    participant BE as Backend
    participant RU as Remote Users
    
    Note over U,RU: Audio Engine & Instrument Creation Flow
    
    U->>AC: User Interaction (Click/Touch)
    AC->>AC: Initialize Audio Context
    AC->>IM: Audio Context Ready
    
    U->>IM: Select Instrument (Guitar/Piano/etc)
    IM->>IE: Create Local Instrument Engine
    IE->>IE: Load Audio Samples (Smplr/Tone.js)
    IE-->>IM: Engine Ready
    IM-->>U: Instrument Loaded
    
    Note over U,RU: Real-time Note Playing
    
    U->>IE: Play Note (Keyboard/MIDI)
    IE->>AC: Generate Audio
    AC->>AC: Process Audio (Effects/Filters)
    AC->>U: Audio Output (Speakers)
    
    par Broadcast to Network
        IE->>S: Emit Note Data
        S->>BE: Forward Note Event
        BE->>RU: Broadcast to Room Members
    end
    
    Note over U,RU: Remote User Join/Leave Handling
    
    RU->>BE: Join Room
    BE->>S: User Joined Event
    S->>IM: Create Remote Engine
    IM->>IE: New Remote Instrument Engine
    IE->>IE: Load Remote User's Instrument
    IE-->>IM: Remote Engine Ready
    
    RU->>BE: Leave Room
    BE->>S: User Left Event
    S->>IM: Cleanup Remote Engine
    IM->>IE: Dispose Remote Engine
    IE->>IE: Stop Audio & Cleanup Resources
    
    Note over U,RU: Instrument Switching
    
    U->>IM: Change Instrument
    IM->>IE: Dispose Current Engine
    IM->>IE: Create New Engine
    IE->>IE: Load New Samples
    IM->>S: Broadcast Instrument Change
    S->>BE: Forward Change Event
    BE->>RU: Notify Other Users
```

### Key Components

#### 1. **Separated Audio Contexts** (`AudioContextManager`)
- **Instrument Context**: Dedicated 44.1kHz context optimized for music production with "interactive" latency
- **WebRTC Context**: Dedicated 48kHz context optimized for voice communication with "balanced" latency
- **Performance Monitoring**: Real-time WebRTC state detection for dynamic optimization
- **Resource Management**: Automatic context suspension/resumption for CPU efficiency

#### 2. **Audio Context Manager** (`useAudioContextManager`)
- Manages Web Audio API context initialization
- Handles browser-specific audio requirements
- Optimizes audio latency and performance
- Provides automatic context resume on user interaction

#### 3. **Instrument Manager** (`useInstrumentManager`)
- **Local Engine Management**: Handles the user's own instrument
- **Remote Engine Management**: Creates and manages instruments for other users
- **Dynamic Loading**: Loads instrument samples on-demand
- **Memory Management**: Efficient cleanup when users leave

#### 4. **Instrument Engine** (`InstrumentEngine`)
- **Dual Audio Stack**:
  - **Traditional Instruments**: Uses Smplr library for realistic samples (guitar, piano, drums)
  - **Synthesizers**: Uses Tone.js for advanced synthesis (analog, FM, filters)
- **Performance Optimizations**:
  - Dynamic polyphony reduction (32 → 16 notes) when WebRTC is active
  - Parameter update throttling (8ms → 16ms) during voice calls
  - Note deduplication to prevent audio flaming
  - Batched note processing for better performance
  - Audio buffer caching for faster loading
- **Safari Compatibility**: Special handling for Safari's audio limitations

### Instrument Categories

#### **Traditional Instruments** (Smplr-based)
- **Guitar**: Realistic guitar samples with multiple playing modes
- **Bass**: Deep bass sounds with melody capabilities  
- **Piano/Keyboard**: High-quality piano samples
- **Drums**: Comprehensive drum kits with individual samples

#### **Synthesizers** (Tone.js-based)
- **Analog Synthesizers**: Classic analog-style synthesis with filters
- **FM Synthesizers**: Advanced frequency modulation synthesis
- **Real-time Parameter Control**: Live tweaking of filters, envelopes, oscillators
- **Preset System**: Save and share synthesizer configurations

## 🎵 Real-time Note Transmission System

The note transmission system ensures low-latency, synchronized musical collaboration:

```mermaid
graph TB
    subgraph "Note Transmission & Reception System"
        A[Local User Input] --> B[Keyboard/MIDI Controller]
        B --> C[Note Event Handler]
        
        subgraph "Local Processing"
            D[Instrument Engine]
            E[Audio Generation]
            F[Audio Context]
            G[Speaker Output]
        end
        
        C --> D
        D --> E
        E --> F
        F --> G
        
        subgraph "Network Layer"
            H[Socket.IO Client]
            I[Note Deduplication]
            J[Message Batching]
            K[Throttling]
        end
        
        C --> H
        H --> I
        I --> J
        J --> K
        
        subgraph "Backend Processing"
            L[Socket.IO Server]
            M[Room Broadcasting]
            N[User Validation]
            O[Rate Limiting]
        end
        
        K --> L
        L --> M
        L --> N
        L --> O
        
        subgraph "Remote User Reception"
            P[Remote Socket Client]
            Q[Note Event Received]
            R[Remote Instrument Engine]
            S[Remote Audio Generation]
            T[Remote Audio Context]
            U[Remote Speaker Output]
        end
        
        M --> P
        P --> Q
        Q --> R
        R --> S
        S --> T
        T --> U
        
        subgraph "Note Data Structure"
            V["<br/>notes: string[]<br/>velocity: number<br/>instrument: string<br/>category: string<br/>eventType: note_on|note_off<br/>isKeyHeld: boolean<br/>userId: string<br/>username: string"]
        end
        
        C --> V
        V --> H
        P --> V
        V --> Q
    end
    
    subgraph "Sustain & Release System"
        W[Sustain Pedal/Toggle]
        X[Key Hold Detection]
        Y[Sustained Notes Tracking]
        Z[Release All Notes]
    end
    
    W --> D
    X --> D
    D --> Y
    W --> Z
    
    style A fill:#e1f5fe
    style D fill:#fff3e0
    style H fill:#f3e5f5
    style L fill:#fce4ec
    style R fill:#e8f5e8
```

### Performance Optimizations

#### **Network Level**
- **Note Deduplication**: Prevents duplicate note events (20ms window)
- **Message Batching**: Groups multiple events for efficient transmission (8ms intervals)
- **Throttled Updates**: Synthesizer parameter changes are throttled (8ms)
- **Connection Pooling**: Reuses socket connections for better performance

#### **Audio Level**
- **Optimized Processing**: 4ms note processing intervals for low latency
- **Batch Audio Operations**: Processes multiple notes simultaneously
- **Memory Management**: Automatic cleanup of audio resources
- **Safari Optimizations**: Special handling for Safari's audio limitations

## 🎙️ WebRTC Voice Communication

Real-time voice chat enables natural communication during jam sessions:

```mermaid
graph TB
    subgraph "WebRTC Voice Communication System"
        A[VoiceInput Component] --> B[useWebRTCVoice Hook]
        
        subgraph "Audio Capture"
            C[getUserMedia API]
            D[MediaStream]
            E[Audio Analysis]
        end
        
        A --> C
        C --> D
        D --> E
        
        subgraph "WebRTC Peer Connections"
            F[RTCPeerConnection Map]
            G[ICE Candidate Exchange]
            H[SDP Offer/Answer]
            I[Audio Streaming]
        end
        
        B --> F
        F --> G
        F --> H
        F --> I
        
        subgraph "Connection Health"
            J[Health Monitoring]
            K[Heartbeat System]
            L[Auto Reconnection]
            M[Grace Period Handling]
        end
        
        B --> J
        J --> K
        J --> L
        J --> M
        
        subgraph "Socket.IO Signaling"
            N[join_voice Event]
            O[voice_offer Event]
            P[voice_answer Event]
            Q[voice_ice_candidate Event]
            R[voice_mute_changed Event]
        end
        
        B --> N
        H --> O
        H --> P
        G --> Q
        E --> R
        
        subgraph "Audio Processing"
            S[Dedicated WebRTC Audio Context]
            T[Analyser Nodes]
            U[Audio Level Detection]
            V[Mute State Management]
            W[48kHz Sample Rate Optimization]
        end
        
        D --> S
        S --> T
        T --> U
        U --> V
        S --> W
        
        subgraph "STUN/TURN Servers"
            W[Google STUN Servers]
            X[NAT Traversal]
        end
        
        F --> W
        W --> X
    end
    
    subgraph "Backend WebRTC Signaling"
        Y[Socket.IO Server]
        Z[Voice Room Management]
        AA[Connection State Tracking]
        BB[Failure Detection & Recovery]
    end
    
    N --> Y
    O --> Y
    P --> Y
    Q --> Y
    R --> Y
    Y --> Z
    Y --> AA
    Y --> BB
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style F fill:#fff3e0
    style Y fill:#fce4ec
```

### WebRTC Features

#### **Reliability & Recovery**
- **Connection Health Monitoring**: 15-second health checks
- **Automatic Reconnection**: Up to 3 reconnection attempts with exponential backoff
- **Heartbeat System**: 30-second heartbeats to detect connection issues
- **Grace Period Management**: 30-second grace period for network interruptions
- **ICE Connection Handling**: Robust handling of connection state changes

#### **Audio Features**
- **Real-time Audio Analysis**: Live audio level detection and visualization
- **Mute State Synchronization**: Synchronized mute/unmute across all users
- **Audio Quality Optimization**: Optimized for low-latency voice communication
- **Cross-platform Support**: Works across different browsers and devices

#### **User Experience**
- **Audience Mode**: Non-transmitting users can still receive audio
- **Visual Indicators**: Real-time audio level visualization
- **Connection Status**: Clear feedback on connection health
- **Automatic Recovery**: Seamless reconnection after network issues

## 🥁 Synchronized Metronome System

The metronome feature keeps all band members in perfect sync with a room-wide tempo that's synchronized across all connected users:

```mermaid
graph TB
    subgraph "Metronome System Architecture"
        A[Metronome Controls UI] --> B[useMetronome Hook]
        
        subgraph "Personal Settings (Local)"
            C[Volume Control]
            D[Mute/Unmute Toggle]
            E[Zustand Persistent Store]
        end
        
        A --> C
        A --> D
        C --> E
        D --> E
        
        subgraph "Room-Wide Settings (Synchronized)"
            F[BPM Control]
            G[Tap Tempo Calculator]
            H[Real-time BPM Updates]
        end
        
        A --> F
        F --> G
        F --> H
        
        subgraph "Audio Generation"
            I[MetronomeSoundService]
            J[Audio Buffer/Oscillator]
            K[Dedicated Audio Context]
            L[Smart Fallback System]
        end
        
        B --> I
        I --> J
        I --> K
        I --> L
        
        subgraph "Backend Synchronization"
            M[MetronomeService]
            N[Room State Management]
            O[Tick Broadcasting]
            P[Interval Management]
        end
        
        H --> M
        M --> N
        M --> O
        M --> P
        
        subgraph "Socket.IO Communication"
            Q[update_metronome Event]
            R[metronome_tick Event]
            S[metronome_state Event]
            T[request_metronome_state Event]
        end
        
        F --> Q
        O --> R
        N --> S
        B --> T
        
        R --> I
        S --> B
        Q --> M
        T --> M
    end
    
    style A fill:#e1f5fe
    style I fill:#fff3e0
    style M fill:#fce4ec
    style E fill:#f3e5f5
```

### Key Features

#### **Room-Wide Synchronization**
- **Shared BPM**: All users hear the same tempo, synchronized via Socket.IO
- **Real-time Updates**: BPM changes instantly propagate to all band members
- **Permission System**: Only room owners and band members can adjust tempo
- **State Persistence**: Current BPM is maintained across user joins/leaves

#### **Advanced Tempo Controls**
- **Manual BPM Input**: Direct numeric input with validation (1-1000 BPM)
- **Tap Tempo**: Calculate BPM by tapping rhythm (up to 8 taps for accuracy)
- **Real-time Preview**: Live tempo updates while typing or tapping
- **BPM Range Validation**: Automatic clamping to valid range with user feedback

#### **Personal Audio Preferences**
- **Individual Volume Control**: Each user controls their own metronome volume
- **Personal Mute**: Mute/unmute without affecting other users
- **Persistent Settings**: Volume and mute preferences saved locally
- **Visual Feedback**: Clear UI indicators for mute state and permissions

#### **High-Quality Audio**
- **Dual Sound System**: 
  - Primary: High-quality audio file (`/public/sounds/metronome-tick.wav`)
  - Fallback: Generated oscillator sound for immediate functionality
- **Smart Audio Loading**: Automatic detection and fallback system
- **Performance Optimized**: Efficient audio generation with minimal CPU impact
- **Browser Compatibility**: Works across all modern browsers

### Technical Implementation

#### **Sound Generation**
```typescript
// Smart audio system with fallback
class MetronomeSoundService {
  // Attempts to load high-quality audio file
  loadTickSound() // metronome-tick.wav
  
  // Falls back to oscillator if file unavailable
  playOscillatorTick() // 800Hz square wave
  
  // Handles audio context management
  initializeAudioContext() // Separate context for metronome
}
```

#### **Tap Tempo Algorithm**
- **Sliding Window**: Maintains up to 8 recent tap timestamps
- **Average Calculation**: Uses mean interval for stable BPM detection
- **Range Clamping**: Automatically constrains to valid BPM range
- **Reset Functionality**: Clear taps to start fresh measurement

#### **Backend Synchronization**
- **Singleton Service**: Single `MetronomeService` instance per server
- **Interval Management**: Precise timing with `setInterval` cleanup
- **Room State**: Each room maintains independent metronome state
- **Broadcasting**: Efficient tick distribution to all room members

### User Experience

#### **Permission-Based Controls**
- **Room Owner**: Full control over metronome settings
- **Band Members**: Can adjust BPM and use tap tempo
- **Audience**: Listen-only mode with personal volume/mute controls
- **Visual Indicators**: Clear UI feedback for permission levels

#### **Smart UI Design**
- **Compact Layout**: Space-efficient controls that don't clutter the interface
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Popup Settings**: Advanced controls in an elegant popup interface
- **Real-time Feedback**: Live updates and validation messages

### Setup Instructions

To enable high-quality metronome sound:

1. **Add Audio File**: Place `metronome-tick.wav` in `/public/sounds/`
2. **File Format**: WAV format recommended for best quality
3. **Fallback Available**: System works immediately even without the file
4. **Indicator**: Yellow dot shows when using fallback sound

The metronome automatically starts when rooms are created and maintains synchronization throughout the entire jam session.

## � Separated Audio Contexts Architecture

The application now uses **separated audio contexts** to eliminate performance competition between instruments and voice communication:

### 🎹 Instrument Audio Context
- **Sample Rate**: 44.1kHz (optimal for music production)
- **Latency Hint**: "interactive" (lowest latency for musical performance)
- **Used by**: Tone.js synthesizers, Smplr instruments (guitar, piano, drums)
- **Optimization**: Dedicated processing for musical instruments

### 🎙️ WebRTC Audio Context  
- **Sample Rate**: 48kHz (preferred by WebRTC standards)
- **Latency Hint**: "balanced" (optimized for voice quality)
- **Used by**: Voice chat, microphone input, remote audio streams
- **Optimization**: Dedicated processing for voice communication

### ⚡ Performance Benefits
- **No Resource Competition**: Instruments and voice chat use separate processing threads
- **Dynamic Polyphony**: Automatic reduction from 32 to 16 simultaneous notes during voice calls
- **CPU Optimization**: Parameter update throttling (8ms → 16ms) when WebRTC is active
- **Context Suspension**: Unused contexts automatically suspended to save resources
- **Better Voice Quality**: WebRTC gets dedicated, properly configured audio processing

### 🔧 Automatic Optimization
The system automatically detects WebRTC usage and applies performance optimizations:
- Reduces instrument polyphony to free CPU for voice processing
- Throttles real-time synthesizer parameter updates
- Suspends unused audio contexts to save system resources
- Maintains high audio quality for both instruments and voice chat

## �🎛️ User Join/Leave Handling

### When a New User Joins:
1. **Room Connection**: User connects to Socket.IO room
2. **Instrument Loading**: System loads user's selected instrument
3. **Engine Creation**: New `InstrumentEngine` instance created
4. **WebRTC Setup**: Voice connection established with existing users
5. **State Synchronization**: Current room state shared with new user
6. **Broadcast**: Other users notified of new member

### When a User Leaves:
1. **Cleanup Signal**: Leave event sent to backend
2. **Engine Disposal**: User's `InstrumentEngine` disposed
3. **WebRTC Cleanup**: Voice connections terminated
4. **Memory Cleanup**: All audio resources released
5. **State Update**: Room state updated for remaining users
6. **Broadcast**: Other users notified of departure

## 🛠️ Tech Stack

### Core Technologies
- **React 19** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **DaisyUI** - Component library built on Tailwind

### State Management & Data
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management
- **Axios** - HTTP client for API calls

### Audio & Music
- **Tone.js** - Web Audio framework for music applications
- **Smplr** - Sample-based audio engine
- **Web Audio API** - Native browser audio capabilities

### Real-time Communication
- **Socket.IO Client** - Real-time bidirectional communication
- **WebRTC** - Peer-to-peer voice communication

### Development Tools
- **ESLint** - Code linting and quality
- **Prettier** - Code formatting
- **SWC** - Fast TypeScript/JSX compilation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Modern web browser with Web Audio API support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jam-band-fe
   ```

2. **Install dependencies**
   ```bash
   # Using npm
   npm install
   
   # Using Bun (recommended)
   bun install
   ```

3. **Start development server**
   ```bash
   # Using npm
   npm run dev
   
   # Using Bun
   bun dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
src/
├── app-config/          # App configuration and routing
├── features/            # Feature-based modules
│   ├── audio/          # Audio processing and voice features
│   │   ├── components/ # Audio UI components
│   │   ├── hooks/      # Audio management hooks
│   │   └── utils/      # Audio utilities
│   ├── instruments/    # Virtual instrument implementations
│   │   ├── components/ # Instrument UI components
│   │   ├── hooks/      # Instrument logic hooks
│   │   ├── stores/     # Instrument state management
│   │   └── utils/      # Instrument utilities
│   ├── rooms/          # Room management and collaboration
│   │   ├── components/ # Room UI components
│   │   ├── hooks/      # Room management hooks
│   │   └── services/   # Room API services
│   └── ui/             # Shared UI components
├── pages/               # Page components
├── shared/              # Shared utilities and components
└── main.tsx            # Application entry point
```

## 🎮 Available Scripts

- **`dev`** - Start development server with hot reload
- **`build`** - Build for production
- **`preview`** - Preview production build locally
- **`lint`** - Run ESLint for code quality
- **`format`** - Format code with Prettier

## 🎹 Instruments

### Guitar
- **Basic Fretboard Mode**: Traditional guitar fretboard interface
- **Chord Mode**: Common chord shapes and progressions
- **Melody Mode**: Single-note lead guitar playing
- **Realistic Samples**: High-quality guitar audio samples

### Bass
- **Melody Bass**: Scale-based note selection for bass lines
- **Deep Sound**: Rich, low-frequency bass tones
- **Customizable Patterns**: Create and modify bass lines

### Keyboard
- **Basic Piano Layout**: Traditional piano keyboard interface
- **Chord Mode**: Play chords with modifier keys
- **Melody Mode**: Single-note piano playing
- **Multiple Octaves**: Full piano range available

### Drums
- **Drum Machine**: Pattern-based drum programming
- **Individual Samples**: Access to individual drum sounds
- **Preset Patterns**: Built-in rhythm patterns
- **Real-time Creation**: Live drum pattern creation

### Synthesizer
- **Multiple Types**: Analog and FM synthesis
- **Real-time Control**: Live parameter tweaking
- **Filter System**: Advanced filtering capabilities
- **Preset Management**: Save and load custom sounds

### Metronome
- **Synchronized Timing**: Room-wide BPM synchronization for all band members
- **Tap Tempo**: Calculate BPM by tapping rhythm
- **Personal Controls**: Individual volume and mute settings
- **High-Quality Sound**: Premium tick sound with smart fallback system

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for local development:
```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### Audio Settings
- **Adjustable Latency**: Optimize for your system
- **Buffer Size Optimization**: Balance latency vs stability
- **Sample Rate Configuration**: Match your audio interface

## 🌐 Browser Support

- **Chrome 90+** - Full feature support
- **Firefox 88+** - Full feature support  
- **Safari 14+** - Full feature support with optimizations
- **Edge 90+** - Full feature support

## 📱 PWA Features

- **Offline Capability**: Core functionality works offline
- **Install Prompt**: Native app-like installation
- **Service Worker**: Intelligent caching strategy
- **App-like Experience**: Full-screen, native feel

## 🔊 Audio Performance

### Separated Context Architecture
- **Dual Audio Contexts**: Instruments (44.1kHz) and WebRTC (48kHz) use dedicated contexts
- **Performance Isolation**: No resource competition between music and voice processing
- **Dynamic Optimization**: Automatic performance scaling based on WebRTC activity

### Latency Optimization
- **4ms Processing Intervals**: Ultra-low latency note processing
- **Context-Specific Optimization**: Each context tuned for its use case (interactive vs balanced)
- **Batch Processing**: Efficient handling of multiple audio events
- **Hardware Acceleration**: Leverages Web Audio API optimizations

### Smart Resource Management
- **Dynamic Polyphony**: 32 notes normal, 16 notes during voice calls
- **Parameter Throttling**: 8ms updates normal, 16ms during WebRTC calls
- **Context Suspension**: Unused contexts automatically suspended to save CPU
- **WebRTC-Aware Optimization**: Real-time performance adjustment based on voice chat activity

### Memory Management
- **Dynamic Loading**: Instruments loaded on-demand
- **Automatic Cleanup**: Resources freed when users leave
- **Audio Buffer Caching**: Intelligent sample caching
- **Memory Monitoring**: Prevents memory leaks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository or contact the development team.

---

*Built with ❤️ for musicians everywhere*
