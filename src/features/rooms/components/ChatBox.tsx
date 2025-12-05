import { MAX_CHAT_MESSAGES } from "../constants/chat";
import React, { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface ChatBoxProps {
  currentUserId: string;
  onSendMessage: (message: string) => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({ currentUserId, onSendMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Scroll chat messages to bottom (without scrolling the whole page)
  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Only auto-scroll if user is already at the bottom
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    // Check if user is at the bottom of chat
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      shouldAutoScroll.current = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
    }

    // Only auto-scroll if user was already at the bottom
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Handle incoming chat messages from socket with deduplication
  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    // Check if we've already processed this message
    if (processedMessageIds.current.has(message.id)) {

      return;
    }

    // Mark this message as processed
    processedMessageIds.current.add(message.id);

    setMessages((prev) => {
      const newMessages = [...prev, message];
      // Keep only the latest MAX_CHAT_MESSAGES
      if (newMessages.length > MAX_CHAT_MESSAGES) {
        // Remove old messages and their IDs from processed set
        const removedMessages = newMessages.slice(
          0,
          newMessages.length - MAX_CHAT_MESSAGES,
        );
        removedMessages.forEach((msg) =>
          processedMessageIds.current.delete(msg.id),
        );
        return newMessages.slice(-MAX_CHAT_MESSAGES);
      }
      return newMessages;
    });
  }, []);

  // Expose the handler for socket events
  useEffect(() => {
    // This will be called from the parent component when socket receives 'chat_message'
    (window as any).handleChatMessage = handleIncomingMessage;

    return () => {
      delete (window as any).handleChatMessage;
    };
  }, [handleIncomingMessage]);

  // Global keyboard event handler to disable shortcuts when chat input is focused
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isChatInput =
        target.hasAttribute("data-chat-input") ||
        target.closest("[data-chat-input]");

      if (isChatInput) {
        // Prevent all keyboard shortcuts when chat input is focused
        // Only allow basic typing keys and navigation
        const allowedKeys = [
          "Backspace",
          "Delete",
          "Enter",
          "Tab",
          "Escape",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
          "Shift",
          "Control",
          "Alt",
          "Meta",
        ];

        // Allow typing keys (letters, numbers, symbols, space)
        const isTypingKey =
          event.key.length === 1 || allowedKeys.includes(event.key);

        if (!isTypingKey) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    };

    const handleGlobalKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isChatInput =
        target.hasAttribute("data-chat-input") ||
        target.closest("[data-chat-input]");

      if (isChatInput) {
        // Stop propagation for keyup events in chat input
        event.stopPropagation();
      }
    };

    // Use capture phase to intercept events before other handlers
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("keyup", handleGlobalKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      window.removeEventListener("keyup", handleGlobalKeyUp, true);
    };
  }, []);

  // Handle scroll events to detect if user manually scrolled
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      shouldAutoScroll.current = scrollTop + clientHeight >= scrollHeight - 10;
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
      // Force auto-scroll after sending message
      shouldAutoScroll.current = true;
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="card bg-base-100 shadow-lg w-full h-full">
      <div className="card-body p-3">
        <h3 className="card-title text-lg">Room Chat</h3>

        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto border border-base-300 rounded-lg p-2 bg-base-50"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="text-center text-base-content/50 mt-36">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className={`flex flex-col ${message.userId === currentUserId
                    ? "items-end"
                    : "items-start"
                    }`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg ${message.userId === currentUserId
                      ? "bg-primary text-primary-content"
                      : "bg-base-200 text-base-content"
                      }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {message.username}
                    </div>
                    <div className="text-sm">{message.message}</div>
                    <div className="text-xs opacity-50 mt-1 text-right">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="input input-bordered flex-1"
            maxLength={500}
            data-chat-input="true"
            onFocus={() => {
              // Ensure the input is properly identified as focused
              inputRef.current?.setAttribute("data-focused", "true");
            }}
            onBlur={() => {
              // Remove the focused attribute when input loses focus
              inputRef.current?.removeAttribute("data-focused");
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="btn btn-primary px-4"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;
