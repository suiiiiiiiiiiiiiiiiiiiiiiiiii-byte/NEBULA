
import { useState } from "react";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  function sendMessage() {
    if (!input.trim()) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: input },
    ]);

    setInput("");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">✦</div>
          <span>My AI</span>
        </div>

        <button
          className="new-chat"
          onClick={() => setMessages([])}
        >
          + New chat
        </button>

        <div className="sidebar-bottom">
          Your personal AI
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>My AI</span>
          <span className="model">Local AI</span>
        </header>

        <section className="chat">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">✦</div>
              <h1>What can I help with?</h1>
              <p>Your own AI. Your own space.</p>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.role}`}
                >
                  {message.content}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="input-area">
          <div className="input-box">
            <textarea
              placeholder="Message My AI..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              className="send-button"
              onClick={sendMessage}
            >
              ↑
            </button>
          </div>

          <p className="disclaimer">
            My AI can make mistakes. Check important information.
          </p>
        </div>
      </main>
    </div>
  );
}
