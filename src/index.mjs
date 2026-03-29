import { createServer } from "node:http";
import { wrapWithLogging } from "./middleware.mjs";
import { createRateLimiter } from "./rate_limiter.mjs";
import { bookmarks, validateBookmark, createBookmark, getBookmarkById, listBookmarks, updateBookmark, deleteBookmark, importBookmarks, exportBookmarks, getBookmarkStats, getRecentBookmarks } from "./bookmarks.mjs";
import { createDriftRoutes } from "./runbook_drift_radar.mjs";

const PORT = process.env.PORT || 3000;

// --- In-memory store ---
const users = new Map();
let nextId = 1;

const todos = new Map();
let nextTodoId = 1;

// --- Body parser ---
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// --- Validation ---
function validateTodo(body) {
  const errors = [];
  if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.length > 200) {
    errors.push("title: required string, 1-200 chars");
  }
  return errors;
}

function validateUser(body) {
  const errors = [];
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.length > 100) {
    errors.push("name: required string, 1-100 chars");
  }
  if (typeof body.email !== "string" || !body.email.includes("@")) {
    errors.push("email: required, must contain @");
  }
  return errors;
}

// --- JSON response helpers ---
function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

// --- Static routes ---
const staticRoutes = {
  "GET /": (req, res) => json(res, 200, { status: "ok", version: "1.0.0" }),
  "GET /health": (req, res) => json(res, 200, { healthy: true }),
};

// --- Dynamic route patterns ---
const dynamicRoutes = [
  {
    method: "POST",
    pattern: /^\/users$/,
    handler: async (req, res) => {
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      const errors = validateUser(body);
      if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
      const id = String(nextId++);
      const user = { id, name: body.name.trim(), email: body.email.trim() };
      users.set(id, user);
      json(res, 201, user);
    },
  },
  {
    method: "GET",
    pattern: /^\/users\/([^/]+)$/,
    handler: (req, res, match) => {
      const user = users.get(match[1]);
      if (!user) return json(res, 404, { error: "User not found" });
      json(res, 200, user);
    },
  },
  {
    method: "PUT",
    pattern: /^\/users\/([^/]+)$/,
    handler: async (req, res, match) => {
      const user = users.get(match[1]);
      if (!user) return json(res, 404, { error: "User not found" });
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      const errors = validateUser(body);
      if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
      user.name = body.name.trim();
      user.email = body.email.trim();
      json(res, 200, user);
    },
  },
  {
    method: "DELETE",
    pattern: /^\/users\/([^/]+)$/,
    handler: (req, res, match) => {
      if (!users.has(match[1])) return json(res, 404, { error: "User not found" });
      users.delete(match[1]);
      res.writeHead(204);
      res.end();
    },
  },
  // --- Todo routes ---
  {
    method: "POST",
    pattern: /^\/todos$/,
    handler: async (req, res) => {
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      const errors = validateTodo(body);
      if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
      const id = String(nextTodoId++);
      const todo = { id, title: body.title.trim(), completed: false };
      todos.set(id, todo);
      json(res, 201, todo);
    },
  },
  {
    method: "GET",
    pattern: /^\/todos$/,
    handler: (req, res) => {
      json(res, 200, [...todos.values()]);
    },
  },
  {
    method: "GET",
    pattern: /^\/todos\/([^/]+)$/,
    handler: (req, res, match) => {
      const todo = todos.get(match[1]);
      if (!todo) return json(res, 404, { error: "Todo not found" });
      json(res, 200, todo);
    },
  },
  {
    method: "PUT",
    pattern: /^\/todos\/([^/]+)$/,
    handler: async (req, res, match) => {
      const todo = todos.get(match[1]);
      if (!todo) return json(res, 404, { error: "Todo not found" });
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      if (body.title !== undefined) {
        if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.length > 200) {
          return json(res, 400, { error: "Validation failed", details: ["title: string, 1-200 chars"] });
        }
        todo.title = body.title.trim();
      }
      if (body.completed !== undefined) {
        if (typeof body.completed !== "boolean") {
          return json(res, 400, { error: "Validation failed", details: ["completed: must be boolean"] });
        }
        todo.completed = body.completed;
      }
      json(res, 200, todo);
    },
  },
  {
    method: "PATCH",
    pattern: /^\/todos\/([^/]+)$/,
    handler: async (req, res, match) => {
      const todo = todos.get(match[1]);
      if (!todo) return json(res, 404, { error: "Todo not found" });
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      const allowedFields = ["title", "completed"];
      const unknown = Object.keys(body).filter(k => !allowedFields.includes(k));
      if (unknown.length) {
        return json(res, 400, { error: "Validation failed", details: [`unknown fields: ${unknown.join(", ")}`] });
      }
      if (body.title !== undefined) {
        if (typeof body.title !== "string" || body.title.trim().length < 1 || body.title.length > 200) {
          return json(res, 400, { error: "Validation failed", details: ["title: string, 1-200 chars"] });
        }
        todo.title = body.title.trim();
      }
      if (body.completed !== undefined) {
        if (typeof body.completed !== "boolean") {
          return json(res, 400, { error: "Validation failed", details: ["completed: must be boolean"] });
        }
        todo.completed = body.completed;
      }
      json(res, 200, todo);
    },
  },
  {
    method: "DELETE",
    pattern: /^\/todos\/([^/]+)$/,
    handler: (req, res, match) => {
      if (!todos.has(match[1])) return json(res, 404, { error: "Todo not found" });
      todos.delete(match[1]);
      res.writeHead(204);
      res.end();
    },
  },
  // --- Bookmark routes ---
  {
    method: "POST",
    pattern: /^\/bookmarks$/,
    handler: async (req, res) => {
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON", details: [] }); }
      const errors = validateBookmark(body);
      if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
      const bookmark = createBookmark(body);
      json(res, 201, bookmark);
    },
  },
  {
    method: "POST",
    pattern: /^\/bookmarks\/import$/,
    handler: async (req, res) => {
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON", details: [] }); }
      const result = importBookmarks(body);
      if (result.error) return json(res, 400, { error: result.error, details: result.details });
      json(res, 201, result.created);
    },
  },
  {
    method: "GET",
    pattern: /^\/bookmarks\/export$/,
    handler: (req, res) => {
      json(res, 200, exportBookmarks());
    },
  },
  {
    method: "GET",
    pattern: /^\/bookmarks\/stats$/,
    handler: (req, res) => {
      json(res, 200, getBookmarkStats());
    },
  },
  {
    method: "GET",
    pattern: /^\/bookmarks\/recent$/,
    handler: (req, res) => {
      json(res, 200, getRecentBookmarks());
    },
  },
  {
    method: "GET",
    pattern: /^\/bookmarks\/([^/]+)$/,
    handler: (req, res, match) => {
      const bookmark = getBookmarkById(match[1]);
      if (!bookmark) return json(res, 404, { error: "Bookmark not found", details: [] });
      json(res, 200, bookmark);
    },
  },
  {
    method: "GET",
    pattern: /^\/bookmarks(?:\?(.*))?$/,
    handler: (req, res, match) => {
      const params = new URLSearchParams(match?.[1] || "");
      const tag = params.get("tag");
      const page = Math.max(1, parseInt(params.get("page")) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(params.get("limit")) || 20));
      json(res, 200, listBookmarks(tag, page, limit));
    },
  },
  {
    method: "PUT",
    pattern: /^\/bookmarks\/([^/]+)$/,
    handler: async (req, res, match) => {
      const id = match[1];
      if (!getBookmarkById(id)) return json(res, 404, { error: "Bookmark not found", details: [] });
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON", details: [] }); }
      const errors = validateBookmark(body);
      if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
      const updated = updateBookmark(id, body);
      json(res, 200, updated);
    },
  },
  {
    method: "DELETE",
    pattern: /^\/bookmarks\/([^/]+)$/,
    handler: (req, res, match) => {
      if (!deleteBookmark(match[1])) return json(res, 404, { error: "Bookmark not found", details: [] });
      res.writeHead(204);
      res.end();
    },
  },
  // --- Drift Radar routes ---
  ...createDriftRoutes(readBody, json),
];

// --- Router (static first, then dynamic) ---
function matchRoute(method, url) {
  const staticKey = `${method} ${url}`;
  if (staticRoutes[staticKey]) return { handler: staticRoutes[staticKey], match: null };
  for (const route of dynamicRoutes) {
    if (route.method !== method) continue;
    const m = url.match(route.pattern);
    if (m) return { handler: route.handler, match: m };
  }
  return null;
}

async function handleRequest(req, res) {
  const result = matchRoute(req.method, req.url);
  if (result) {
    await result.handler(req, res, result.match);
  } else {
    json(res, 404, { error: "not found" });
  }
}

const rateLimit = createRateLimiter({ maxRequests: 100, windowMs: 60_000 });
const server = createServer(wrapWithLogging(rateLimit(handleRequest)));

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  server.listen(PORT, () => console.log(`Listening on :${PORT}`));
}

export { handleRequest, matchRoute, users, todos, bookmarks, json, validateUser, validateTodo, readBody, server };
