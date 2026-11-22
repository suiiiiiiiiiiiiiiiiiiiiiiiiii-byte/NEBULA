
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

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
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(JSON.stringify(data));
}

async function proxyToOllama(req, res, endpoint) {
  try {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const response = await fetch(`${OLLAMA_URL}${endpoint}`, {
          method: req.method,
          headers: {
            "Content-Type": "application/json"
          },
          body: req.method === "POST" ? body : undefined
        });

        const contentType =
          response.headers.get("content-type") ||
          "application/json; charset=utf-8";

        res.writeHead(response.status, {
          "Content-Type": contentType
        });

        if (!response.body) {
          res.end();
          return;
        }

        // Forward Ollama's response stream so chat can stream.
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          res.write(value);
        }

        res.end();
      } catch (error) {
        console.error("Ollama proxy error:", error.message);

        sendJson(res, 502, {
          error: "Could not connect to the AI server.",
          details: error.message
        });
      }
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Server error",
      details: error.message
    });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Allow browser preflight requests.
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end();
    return;
  }

  // Ollama model list
  if (url.pathname === "/api/models" && req.method === "GET") {
    proxyToOllama(req, res, "/api/tags");
    return;
  }

  // Ollama chat
  if (url.pathname === "/api/chat" && req.method === "POST") {
    proxyToOllama(req, res, "/api/chat");
    return;
  }

  // Serve website files
  let requestedPath = decodeURIComponent(url.pathname);

  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  const filePath = path.resolve(
    PUBLIC_DIR,
    "." + requestedPath
  );

  // Prevent requests from escaping the public directory.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) &&
      filePath !== path.join(PUBLIC_DIR, "index.html")) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "File not found" });
      } else {
        sendJson(res, 500, { error: "Could not read file" });
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
