
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Groq configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

app.use(express.json({ limit: "1mb" }));

// Serve Nebula's website
app.use(express.static(path.join(__dirname, "public")));

// Check server status
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Groq",
    configured: Boolean(GROQ_API_KEY)
  });
});

// Available model
app.get("/api/models", (req, res) => {
  res.json({
    models: [
      {
        name: GROQ_MODEL,
        model: GROQ_MODEL
      }
    ]
  });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");

      return res.status(500).json({
        error: "GROQ_API_KEY is not configured on the server"
      });
    }

    const messages = req.body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are missing or invalid"
      });
    }

    // Keep only supported chat message fields
    const cleanMessages = messages
      .filter((msg) =>
        ["system", "user", "assistant"].includes(msg.role)
      )
      .map((msg) => ({
        role: msg.role,
        content: msg.content
      }));

    if (cleanMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages were provided"
      });
    }

    console.log("Sending chat request to Groq...");

    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: cleanMessages,
        stream: false
      })
    });

    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      const errorMessage =
        result?.error?.message || "Groq API request failed";

      console.error(
        `Groq API error (${groqResponse.status}):`,
        errorMessage
      );

      return res.status(groqResponse.status).json({
        error: `Groq API error: ${errorMessage}`
      });
    }

    const answer =
      result?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error("Groq returned an empty response");

      return res.status(502).json({
        error: "Groq returned an empty response"
      });
    }

    console.log("Groq response received successfully");

    // Preserve Nebula's existing response format
    return res.json({
      message: {
        role: "assistant",
        content: answer
      },
      done: true,
      model: GROQ_MODEL
    });

  } catch (error) {
    console.error("Chat server error:", error.message);

    return res.status(500).json({
      error: "The server could not connect to Groq"
    });
  }
});

// Send the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Nebula AI running on port ${PORT}`);
  console.log("AI provider: Groq");
  console.log(`Groq model: ${GROQ_MODEL}`);
  console.log(
    `GROQ_API_KEY configured: ${Boolean(GROQ_API_KEY)}`
  );
});
