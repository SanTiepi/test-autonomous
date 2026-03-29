// Shared HTTP utilities for V2 modules

export function readBody(req) {
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

export function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createRouter(routes) {
  return async function route(req, res) {
    const url = req.url.split("?")[0];
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.match(r.pattern);
      if (m) return r.handler(req, res, m);
    }
    json(res, 404, { error: "Not found" });
  };
}
