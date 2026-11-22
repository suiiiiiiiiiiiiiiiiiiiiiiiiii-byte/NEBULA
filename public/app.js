
const messagesElement = document.getElementById("messages");
const promptElement = document.getElementById("prompt");
const form = document.getElementById("chatForm");
const sendButton = document.querySelector("#sendButton, .send-button");
const modelSelect = document.getElementById("modelSelect");
const statusElement = document.getElementById("status");

let history = [];

function addMessage(role, content) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = content;
  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return message;
}

function showWelcome() {
  messagesElement.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">✦</div>
      <h1>What can I help with?</h1>
      <p>Your own AI. Your own space.</p>
    </div>
  `;
}

async function loadModels() {
  try {
    const response = await fetch("/api/models");
    if (!response.ok) throw new Error("Ollama is not responding");

    const data = await response.json();
    modelSelect.innerHTML = "";

    if (!data.models || data.models.length === 0) {
      statusElement.textContent = "No Ollama models found. Download one first.";
      return;
    }

    data.models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });

    statusElement.textContent = "Connected to Ollama";
  } catch {
    statusElement.textContent =
      "Can't connect to Ollama. Make sure Ollama is running.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = promptElement.value.trim();
  const model = modelSelect.value;

  if (!text || !model) return;

  if (history.length === 0) {
    messagesElement.innerHTML = "";
  }

  history.push({ role: "user", content: text });
  addMessage("user", text);

  promptElement.value = "";
  sendButton.disabled = true;
  statusElement.textContent = "Thinking...";

  const thinking = addMessage("assistant", "Thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: history,
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Chat request failed");
    }

    const reply = data.message?.content || "No response received.";
    history.push({ role: "assistant", content: reply });
    thinking.textContent = reply;
    statusElement.textContent = "Connected to Ollama";
  } catch (error) {
    thinking.textContent = "Sorry, I couldn't get a response.";
    statusElement.textContent = error.message;
  } finally {
    sendButton.disabled = false;
    promptElement.focus();
  }
});

document.getElementById("newChat").addEventListener("click", () => {
  history = [];
  showWelcome();
  statusElement.textContent = "New chat";
});

promptElement.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

loadModels();
