import { createServer } from "node:http";

const PORT = process.env.PORT || 3000;

const routes = {
  "GET /": (req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "1.0.0" }));
  },
  "GET /health": (req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ healthy: true }));
  },
};

function handleRequest(req, res) {
  const key = `${req.method} ${req.url}`;
  const handler = routes[key];
  if (handler) {
    handler(req, res);
  } else {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}

const server = createServer(handleRequest);
server.listen(PORT, () => console.log(`Listening on :${PORT}`));

export { handleRequest, routes };
