# COLLAB - Jam Band Frontend

> **🎵 A real-time collaborative music-making web application**  
> Built for musicians who want to jam together online with minimal latency!

## ⚠️ Project Disclaimer

**This is a vibe-coding project** by a frontend developer who:
- 🎯 Has some knowledge of music theory
- 🎸 Can play some instruments
- 💻 Is passionate about coding and music
- 🚧 Built this while jamming to music and exploring the creative intersection of coding and music production

*This is NOT a professional music production tool. It's a fun, experimental project for learning and jamming with friends!*

## 🎵 What It Does

Jam Band lets you create music together with friends in real-time using **virtual instruments with music theory assistance** for low-mid level musicians, and **physical instrument support** for high-level players who want to plug in their real instruments.

**Current: Perform Room** - Perfect for **live jamming sessions** with synchronized instruments, step sequencers, and ultra-low latency voice chat. Ideal for remote jam sessions, music lessons, skill development, or just having fun making music together.

**Future: Produce Room** - Revolutionary **collaborative DAW** where multiple users can simultaneously create tracks, record audio/MIDI regions, edit notes, and mix projects in real-time. Think **Miro or Figma but for music production** - a paradigm shift from traditional single-user DAWs to real-time collaborative music creation.

## ✨ Key Features

### Current Features (Live Jamming)
- **🎸 Virtual Instruments**: Guitar, Bass, Keyboard, Drums, Synthesizer with real-time collaboration
- **🎤 Ultra-Low Latency Voice Chat**: WebRTC mesh network optimized for musical timing
- **🥁 Synchronized Metronome**: BPM synchronization across all users with visual indicators
- **🎼 Step Sequencer**: Collaborative pattern creation and loop sharing
- **🎚️ Audio Effects**: Real-time effects chains (reverb, delay, distortion) with live parameter control
- **🎹 MIDI Controller Support**: Full external MIDI device integration
- **👥 Advanced Room Management**: Owner/member roles, approval system, room settings
- **📱 PWA Support**: Installable app with offline capabilities and push notifications
- **🎵 Music Theory Assistance**: Scale helpers
- **⚡ Performance Optimization**: Dynamic polyphony, adaptive audio quality, browser-specific optimizations
- **🧪 Comprehensive Testing**: 76 passing tests with regression prevention for all features

### 🚀 Future: Collaborative DAW (Produce Room)
*Coming Soon: Revolutionary real-time collaborative music production*

- **🎛️ Real-time Collaborative DAW**: Multiple users editing tracks simultaneously like Google Docs for music
- **🎨 Canvas-style Interface**: Miro/Figma-like collaboration patterns adapted for music production
- **👥 Multi-user Timeline Editing**: Simultaneous track editing with presence tracking and conflict resolution
- **🎵 Collaborative Region Recording**: Multiple users recording audio/MIDI regions to different tracks in real-time
- **🎚️ Collaborative Mixing**: Real-time parameter adjustments across users with operational transform
- **💾 Project Persistence**: Save and resume collaborative music projects with version history
- **👀 Presence Tracking**: See where other users are working (cursors, selections, active regions)
- **🔧 Smart Conflict Resolution**: Automatic handling of simultaneous edits using operational transform patterns

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- Modern web browser with Web Audio API support

### Installation

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd jam-band-fe
   bun install
   ```

2. **Start development**
   ```bash
   bun dev
   ```

3. **Open browser**
   Navigate to `http://localhost:5173`

4. **Run tests (optional)**
   ```bash
   bun test
   ```

## 🎛️ Audio Architecture

### **Ultra-Low Latency Design**
- **Instruments**: 48kHz, `"interactive"` latency hint for minimal musical delay
- **Voice Chat**: 48kHz, `"interactive"` latency hint for minimal voice delay
- **Separated Contexts**: No competition between music and voice processing
- **Dynamic Optimization**: Automatic performance scaling during voice calls

### **Performance Features**
- 4ms note processing intervals
- Dynamic polyphony (32 → 6 notes during voice calls)
- Browser-specific optimizations
- Network optimizations for mesh networks

## ⚙️ Technical Requirements & Notes

### **Current Implementation (POC)**
- **WebRTC Mesh Network**: Using WebRTC mesh for ultra-low latency, but this limits the number of participants per session
- **Voice Latency**: Depends on your browser and hardware. Technically, we cannot bypass the browser's audio processing pipeline
- **Server Location**: Currently only in Southeast Asia, so latency may vary depending on your geographical location

### **Network Recommendations**
- **LAN Cable**: Recommended over WiFi or cellular for stable and low latency
- **Stable Connection**: Ensure your network connection is stable for the best experience
- **Bandwidth**: Sufficient bandwidth for real-time audio streaming

### **Browser Compatibility**
- **Chromium-based Browsers**: Chrome, Edge, Brave recommended for:
  - Full MIDI device connection support
  - Complete synthesizer instrument functionality
  - Best overall performance
- **WebKit Browsers**: Some instruments may not work properly
- **Modern Browsers**: Web Audio API support required

### **Pro Tips for Best Performance**
- Close unnecessary browser tabs and applications
- Use headphones to avoid audio feedback
- Ensure microphone permissions are enabled
- Test your audio setup before joining a session
- Use a wired internet connection when possible

## 🎯 Perfect For

### Current (Perform Room - Live Jamming)
- **🎵 Low-Mid Level Musicians**: Virtual instruments with built-in music theory assistance
- **🎸 High-Level Players**: Plug in physical instruments for real-time collaboration
- **🎤 Singers**: Minimal delay between singing and hearing playback
- **🎓 Music Learners**: Built-in scales, chords, and theory helpers
- **🎛️ Music Producers**: Brainstorm ideas, experiment with synthesizers, create patterns
- **🌍 Remote Collaboration**: Jam with friends anywhere in the world

### Future (Produce Room - Collaborative Production)
- **🎼 Music Production Teams**: Collaborate on full tracks like working on a shared document
- **🎧 Remix Artists**: Multiple producers working on the same project simultaneously
- **🎵 Songwriters**: Real-time collaborative composition with multi-user MIDI editing
- **🎚️ Mix Engineers**: Collaborative mixing sessions with live parameter adjustments
- **🎓 Music Education**: Teachers and students working together on production projects
- **🏢 Music Studios**: Distributed production workflows across multiple locations

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **Audio**: Web Audio API, Tone.js 15, Smplr 0.16
- **Real-time**: Socket.IO 4.8, WebRTC
- **State**: Zustand 5, TanStack Query 5
- **Styling**: Tailwind CSS 4, DaisyUI 5
- **Testing**: Vitest 2, React Testing Library 16, 74 comprehensive tests with regression prevention
- **PWA**: VitePWA with Workbox
- **Dev Tools**: ESLint 9, Prettier 3, TypeScript 5.8

## 📁 Project Structure

```
src/
├── features/           # Feature-based architecture
│   ├── audio/          # Audio processing & WebRTC voice
│   ├── instruments/    # Virtual instruments (Guitar, Bass, Drums, Synth)
│   ├── rooms/          # Room management & Socket.IO integration
│   │   ├── core/       # Room type architecture (Perform + Future Produce)
│   │   └── types/      # RoomType configurations & factory patterns
│   ├── metronome/      # Synchronized timing across users
│   ├── sequencer/      # Step sequencer for pattern creation
│   ├── effects/        # Audio effects chains
│   └── ui/             # Shared UI components & state
├── shared/             # Cross-feature utilities & stores
├── pages/              # Main app routes (Lobby, PerformRoom, Invite)
├── app-config/         # Router & provider configuration
├── test/               # Test setup & utilities
└── __tests__/          # Integration tests & testing documentation
```

## 🎮 Available Scripts

- **`bun dev`** - Start development server with HTTPS (required for WebRTC)
- **`bun build`** - TypeScript compilation + Vite production build
- **`bun preview`** - Preview production build locally
- **`bun lint`** - Run ESLint with React hooks rules
- **`bun format`** - Format code with Prettier
- **`bun test`** - Run comprehensive test suite (74 tests with regression prevention)
- **`bun test:run`** - Run tests once (CI mode)
- **`bun test:ui`** - Run tests with interactive UI dashboard
- **`bun test:coverage`** - Generate detailed coverage reports
- **`bun test integration`** - Run cross-feature integration tests

## 🌐 Browser Support

- **Chrome 90+** ✅ *Recommended - Full MIDI & synthesizer support*
- **Edge 90+** ✅ *Recommended - Full MIDI & synthesizer support*
- **Brave 90+** ✅ *Recommended - Full MIDI & synthesizer support*
- **Firefox 88+** ⚠️ *Limited MIDI support, some synthesizer instruments may not work*
- **Safari 14+** ⚠️ *WebKit limitations - some instruments don't work properly*

> **Best Performance**: Chromium-based browsers (Chrome, Edge, Brave) provide the most reliable Web Audio API implementation and full MIDI device support.

## 🔧 Configuration

### Environment Variables
Create `.env.local`:
```env
VITE_API_URL=http://localhost:3001
```

> **Note**: Socket.IO URL is automatically derived from API URL. HTTPS is auto-configured in development via `vite-plugin-mkcert` for WebRTC compatibility.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

---

*Built with ❤️ for musicians everywhere*

> **Note**: This app prioritizes **lowest latency over audio quality** - perfect for real-time musical collaboration where timing is everything!
