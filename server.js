
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON request."));
      }
    });

    req.on("error", reject);
  });
}

async function handleChat(req, res) {
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, {
      error: "GEMINI_API_KEY is not configured on the server."
    });
    return;
  }

  try {
    const body = await readRequestBody(req);

    if (!Array.isArray(body.messages)) {
      sendJson(res, 400, {
        error: "The request must include a messages array."
      });
      return;
    }

    let systemText = "";

    const contents = body.messages
      .filter((message) => {
        return message && typeof message.content === "string";
      })
      .map((message) => {
        if (message.role === "system") {
          systemText += message.content + "\n";
          return null;
        }

        const role =
          message.role === "assistant" ? "model" : "user";

        return {
          role,
          parts: [{ text: message.content }]
        };
      })
      .filter(Boolean);

    if (contents.length === 0) {
      sendJson(res, 400, {
        error: "No chat messages were provided."
      });
      return;
    }

    const geminiRequest = {
      contents,
      generationConfig: {
        temperature: 0.7
      }
    };

    if (systemText.trim()) {
      geminiRequest.systemInstruction = {
        parts: [{ text: systemText.trim() }]
      };
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(geminiRequest)
      }
    );

    const result = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", result);

      sendJson(res, geminiResponse.status, {
        error:
          result.error?.message ||
          "Gemini could not process the request."
      });
      return;
    }

    const answer = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

    if (!answer) {
      sendJson(res, 502, {
        error: "Gemini returned an empty response."
      });
      return;
    }

    const ollamaStyleResponse = {
      message: {
        role: "assistant",
        content: answer
      },
      done: true
    };

    if (body.stream !== false) {
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8"
      });

      res.end(JSON.stringify(ollamaStyleResponse) + "\n");
      return;
    }

    sendJson(res, 200, ollamaStyleResponse);
  } catch (error) {
    console.error("Chat server error:", error.message);

    if (!res.headersSent) {
      sendJson(res, 500, {
        error: "The server could not process your chat request."
      });
    } else {
      res.end();
    }
  }
}

const server = http.createServer((req, res) => {
  let url;

  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch {
    sendJson(res, 400, { error: "Invalid URL" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end();
    return;
  }

  // Gemini model list
  if (url.pathname === "/api/models" && req.method === "GET") {
    sendJson(res, 200, {
      models: [
        { name: GEMINI_MODEL }
      ]
    });
    return;
  }

  // Gemini chat
  if (url.pathname === "/api/chat" && req.method === "POST") {
    handleChat(req, res);
    return;
  }

  // Serve website files
  let requestedPath;

  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    sendJson(res, 400, { error: "Invalid file path" });
    return;
  }

  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const filePath = path.resolve(
    PUBLIC_DIR,
    "." + requestedPath
  );

  // Prevent requests from escaping the public directory.
  if (
    !filePath.startsWith(PUBLIC_DIR + path.sep) &&
    filePath !== path.join(PUBLIC_DIR, "index.html")
  ) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "File not found" });
      } else {
        sendJson(res, 500, {
          error: "Could not read file"
        });
      }

      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      MIME_TYPES[extension] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType
    });

    res.end(content);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Nebula AI running on port ${PORT}`);
});
