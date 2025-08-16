import { Modal } from "./shared/Modal";
import React, { useState } from "react";

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [showAboutModal, setShowAboutModal] = useState(false);

  return (
    <>
      <footer className="bg-base-300 text-base-content py-3 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold text-lg">collab</span>
              <span className="text-sm text-base-content/70">•</span>
              <span className="text-sm text-base-content/70">
                © {currentYear} by{" "}
                <a
                  href="http://themiddnight-resume.vercel.app/resumes/themiddnight-dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  Pathompong Thitithan
                </a>
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-base-content/70">
              <a
                href="https://github.com/themiddnight/jam-band-fe"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                GitHub
              </a>
              <span>•</span>
              <button
                onClick={() => setShowAboutModal(true)}
                className="hover:text-primary transition-colors"
              >
                About
              </button>
            </div>
          </div>
        </div>
      </footer>

      <Modal
        open={showAboutModal}
        setOpen={setShowAboutModal}
        title="About COLLAB"
        size="lg"
        showCancelButton={false}
        showOkButton={true}
        okText="Close"
      >
        <div className="space-y-6 px-2">
          <div>
            <p className="text-base-content/80 leading-relaxed">
              COLLAB is a Proof of Concept (POC) for my idea to create an
              application where users can jam together in real-time. This
              collaborative music platform allows multiple users to play
              different instruments simultaneously, creating a virtual band
              experience through the web.
            </p>
            <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-xs text-primary leading-relaxed">
                🎵 This is a <span className="font-bold">vibe-coding</span>{" "}
                project (Even this contents was generated with a little help
                from AI! 🤓📝) - built while jamming to music and exploring the
                creative intersection of coding and music production! 🤖✨
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-3">Tech Stack</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-primary mb-2">Frontend</h5>
                <ul className="space-y-1 text-sm text-base-content/70">
                  <li>• React 19 + TypeScript</li>
                  <li>• Vite (Build tool)</li>
                  <li>• Tailwind CSS 4</li>
                  <li>• DaisyUI (Component library)</li>
                  <li>• Zustand (State management)</li>
                  <li>• React Router DOM</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-primary mb-2">Audio & Music</h5>
                <ul className="space-y-1 text-sm text-base-content/70">
                  <li>• Tone.js (Audio framework)</li>
                  <li>• Smplr (Sample player)</li>
                  <li>• Web Audio API</li>
                  <li>• MIDI support</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-primary mb-2">Backend</h5>
                <ul className="space-y-1 text-sm text-base-content/70">
                  <li>• Node.js + Express</li>
                  <li>• TypeScript</li>
                  <li>• Socket.IO (Real-time communication)</li>
                  <li>• Winston (Logging)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-primary mb-2">
                  Additional Features
                </h5>
                <ul className="space-y-1 text-sm text-base-content/70">
                  <li>• PWA support</li>
                  <li>• WebRTC voice chat</li>
                  <li>• Real-time collaboration</li>
                  <li>• Responsive design</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-2">Features</h4>
            <ul className="space-y-1 text-sm text-base-content/70">
              <li>
                • Multiple virtual instruments (Guitar, Bass, Keyboard, Drums,
                Synthesizer)
              </li>
              <li>• Real-time collaborative jamming sessions</li>
              <li>• Synchronized metronome with tap tempo and personal controls</li>
              <li>• Voice input and chat capabilities</li>
              <li>• MIDI controller support</li>
              <li>• Preset management for instruments</li>
              <li>• Room-based collaboration system</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-lg mb-2">Server Information</h4>
            <div className="p-3 bg-base-200 rounded-lg border border-base-300">
              <p className="text-sm text-base-content/80 leading-relaxed">
                <span className="font-medium">🌏 Server Location:</span>{" "}
                Southeast Asia
                <br />
                <span className="font-medium">⚡ Latency Note:</span> Connection
                latency may vary depending on your geographical location. Users
                closer to Southeast Asia will experience lower latency for
                optimal real-time jamming experience.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-base-300">
            <p className="text-xs text-base-content/60 text-center">
              This is a personal project by Pathompong Thitithan. Built with
              modern web technologies to explore the possibilities of
              collaborative music creation online.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};
