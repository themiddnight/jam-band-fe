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

**Perfect for music producers** who want to brainstorm ideas, experiment with synthesizers, create patterns with step sequencers, and collaborate in real-time with live communication. Ideal for remote jam sessions, music lessons, skill development, or just having fun making music together.

## ✨ Key Features

- **🎸 Virtual Instruments**: Guitar, Bass, Keyboard, Drums, Synthesizer
- **🎤 Ultra-Low Latency Voice Chat**: Optimized for real-time performance over audio quality
- **🥁 Synchronized Metronome**: Keep time together across all users
- **🎼 Step Sequencer**: Create patterns and sequences together
- **🎹 MIDI Controller Support**: Use your external MIDI devices
- **👥 Room Management**: Role-based access (owner, band member, audience)
- **📱 PWA Support**: Install as a native app

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

## 🎯 Perfect For

- **🎵 Low-Mid Level Musicians**: Virtual instruments with built-in music theory assistance
- **🎸 High-Level Players**: Plug in physical instruments for real-time collaboration
- **🎤 Singers**: Minimal delay between singing and hearing playback
- **🎓 Music Learners**: Built-in scales, chords, and theory helpers
- **🎛️ Music Producers**: Brainstorm ideas, experiment with synthesizers, create patterns
- **🌍 Remote Collaboration**: Jam with friends anywhere in the world

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Audio**: Web Audio API, Tone.js, Smplr
- **Real-time**: Socket.IO, WebRTC
- **State**: Zustand, TanStack Query
- **Styling**: Tailwind CSS, DaisyUI

## 📁 Project Structure

```
src/
├── features/
│   ├── audio/          # Audio processing & voice
│   ├── instruments/    # Virtual instruments
│   ├── rooms/          # Room management
│   └── metronome/      # Synchronized timing
├── shared/             # Utilities & components
└── pages/              # Main app pages
```

## 🎮 Available Scripts

- **`bun dev`** - Start development server
- **`bun build`** - Build for production
- **`bun preview`** - Preview production build
- **`bun lint`** - Run ESLint

## 🌐 Browser Support

- **Chrome 90+** ✅
- **Firefox 88+** ✅  
- **Safari 14+** ✅
- **Edge 90+** ✅

## 🔧 Configuration

### Environment Variables
Create `.env.local`:
```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

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
