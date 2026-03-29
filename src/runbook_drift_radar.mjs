// Runbook Drift Radar — track API contract drift between expected runbooks and observed behavior

// --- In-memory stores ---
const runbooks = new Map();
const observations = new Map(); // runbookId -> [observation, ...]
const alerts = new Map();
let nextRunbookId = 1;
let nextObservationId = 1;
let nextAlertId = 1;

// --- Validation ---
const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function validateRunbook(body) {
  const errors = [];
  if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.length > 200) {
    errors.push("name: required string, 1-200 chars");
  }
  if (!Array.isArray(body.endpoints) || body.endpoints.length < 1) {
    errors.push("endpoints: required non-empty array");
    return errors;
  }
  for (let i = 0; i < body.endpoints.length; i++) {
    const ep = body.endpoints[i];
    if (typeof ep.path !== "string" || ep.path.trim().length < 1) {
      errors.push(`endpoints[${i}].path: required non-empty string`);
    }
    if (typeof ep.method !== "string" || !VALID_METHODS.includes(ep.method.toUpperCase())) {
      errors.push(`endpoints[${i}].method: required valid HTTP method`);
    }
    if (typeof ep.expectedStatus !== "number" || ep.expectedStatus < 100 || ep.expectedStatus > 599) {
      errors.push(`endpoints[${i}].expectedStatus: required number 100-599`);
    }
    if (ep.expectedShape !== undefined && (typeof ep.expectedShape !== "object" || ep.expectedShape === null || Array.isArray(ep.expectedShape))) {
      errors.push(`endpoints[${i}].expectedShape: must be object mapping field names to types`);
    }
    if (ep.maxLatencyMs !== undefined && (typeof ep.maxLatencyMs !== "number" || ep.maxLatencyMs <= 0)) {
      errors.push(`endpoints[${i}].maxLatencyMs: must be a positive number`);
    }
  }
  return errors;
}

function validateObservation(body) {
  const errors = [];
  if (typeof body.endpointPath !== "string" || body.endpointPath.trim().length < 1) {
    errors.push("endpointPath: required non-empty string");
  }
  if (typeof body.method !== "string" || body.method.trim().length < 1) {
    errors.push("method: required non-empty string");
  }
  if (typeof body.actualStatus !== "number" || body.actualStatus < 100 || body.actualStatus > 599) {
    errors.push("actualStatus: required number 100-599");
  }
  if (body.actualShape !== undefined && (typeof body.actualShape !== "object" || body.actualShape === null || Array.isArray(body.actualShape))) {
    errors.push("actualShape: must be object mapping field names to types");
  }
  if (body.latencyMs !== undefined && (typeof body.latencyMs !== "number" || body.latencyMs < 0)) {
    errors.push("latencyMs: must be a non-negative number");
  }
  return errors;
}

// --- Drift detection ---
function detectDrifts(endpoint, observation) {
  const drifts = [];

  // Status code drift
  if (observation.actualStatus !== endpoint.expectedStatus) {
    drifts.push({
      type: "status",
      field: "statusCode",
      expected: endpoint.expectedStatus,
      actual: observation.actualStatus,
      severity: "critical",
    });
  }

  // Shape drift
  if (endpoint.expectedShape && observation.actualShape) {
    const expectedKeys = Object.keys(endpoint.expectedShape);
    const actualKeys = Object.keys(observation.actualShape);

    for (const key of expectedKeys) {
      if (!(key in observation.actualShape)) {
        drifts.push({ type: "missing_field", field: key, expected: endpoint.expectedShape[key], actual: null, severity: "high" });
      } else if (endpoint.expectedShape[key] !== observation.actualShape[key]) {
        drifts.push({ type: "type_mismatch", field: key, expected: endpoint.expectedShape[key], actual: observation.actualShape[key], severity: "high" });
      }
    }

    for (const key of actualKeys) {
      if (!(key in endpoint.expectedShape)) {
        drifts.push({ type: "extra_field", field: key, expected: null, actual: observation.actualShape[key], severity: "low" });
      }
    }
  }

  // Latency drift
  if (endpoint.maxLatencyMs && observation.latencyMs !== undefined && observation.latencyMs !== null && observation.latencyMs > endpoint.maxLatencyMs) {
    drifts.push({
      type: "latency_breach",
      field: "latencyMs",
      expected: endpoint.maxLatencyMs,
      actual: observation.latencyMs,
      severity: "medium",
    });
  }

  return drifts;
}

// --- Alert management ---
function findOrCreateAlert(runbookId, endpointPath, drift) {
  for (const alert of alerts.values()) {
    if (alert.runbookId === runbookId && alert.endpointPath === endpointPath && alert.type === drift.type && alert.field === drift.field && alert.status === "active") {
      alert.occurrences += 1;
      alert.lastSeenAt = new Date().toISOString();
      alert.actual = drift.actual;
      return alert;
    }
  }
  const id = String(nextAlertId++);
  const now = new Date().toISOString();
  const alert = {
    id,
    runbookId,
    endpointPath,
    type: drift.type,
    field: drift.field,
    expected: drift.expected,
    actual: drift.actual,
    severity: drift.severity,
    status: "active",
    occurrences: 1,
    detectedAt: now,
    lastSeenAt: now,
    resolvedAt: null,
    resolution: null,
  };
  alerts.set(id, alert);
  return alert;
}

// --- Data access ---
function createRunbook(body) {
  const id = String(nextRunbookId++);
  const now = new Date().toISOString();
  const runbook = {
    id,
    name: body.name.trim(),
    description: (body.description || "").trim(),
    endpoints: body.endpoints.map((ep) => ({
      path: ep.path.trim(),
      method: ep.method.toUpperCase(),
      expectedStatus: ep.expectedStatus,
      expectedShape: ep.expectedShape || null,
      maxLatencyMs: ep.maxLatencyMs || null,
    })),
    createdAt: now,
    updatedAt: now,
  };
  runbooks.set(id, runbook);
  observations.set(id, []);
  return runbook;
}

function getRunbook(id) {
  return runbooks.get(id) || null;
}

function listAllRunbooks() {
  return [...runbooks.values()];
}

function recordObservation(runbookId, body) {
  const runbook = runbooks.get(runbookId);
  if (!runbook) return null;

  const id = String(nextObservationId++);
  const observation = {
    id,
    runbookId,
    endpointPath: body.endpointPath.trim(),
    method: body.method.toUpperCase(),
    actualStatus: body.actualStatus,
    actualShape: body.actualShape || null,
    latencyMs: body.latencyMs ?? null,
    observedAt: new Date().toISOString(),
  };
  observations.get(runbookId).push(observation);

  // Match against runbook endpoint spec
  const endpoint = runbook.endpoints.find((ep) => ep.path === observation.endpointPath && ep.method === observation.method);
  const drifts = endpoint ? detectDrifts(endpoint, observation) : [];
  const newAlerts = drifts.map((d) => findOrCreateAlert(runbookId, observation.endpointPath, d));

  return { observation, drifts, alerts: newAlerts };
}

function getDriftReport(runbookId) {
  const runbook = runbooks.get(runbookId);
  if (!runbook) return null;

  const obs = observations.get(runbookId) || [];
  const runbookAlerts = [...alerts.values()].filter((a) => a.runbookId === runbookId);
  const activeAlerts = runbookAlerts.filter((a) => a.status === "active");

  const endpoints = runbook.endpoints.map((ep) => {
    const epObs = obs.filter((o) => o.endpointPath === ep.path && o.method === ep.method);
    const epAlerts = activeAlerts.filter((a) => a.endpointPath === ep.path);
    return {
      path: ep.path,
      method: ep.method,
      observationCount: epObs.length,
      activeAlertCount: epAlerts.length,
      lastObservedAt: epObs.length > 0 ? epObs[epObs.length - 1].observedAt : null,
      alerts: epAlerts,
    };
  });

  return {
    runbookId,
    runbookName: runbook.name,
    totalObservations: obs.length,
    totalActiveAlerts: activeAlerts.length,
    totalResolvedAlerts: runbookAlerts.filter((a) => a.status === "resolved").length,
    endpoints,
  };
}

function listActiveAlerts(runbookId) {
  let result = [...alerts.values()].filter((a) => a.status === "active");
  if (runbookId) result = result.filter((a) => a.runbookId === runbookId);
  return result;
}

function listAllAlerts(runbookId) {
  let result = [...alerts.values()];
  if (runbookId) result = result.filter((a) => a.runbookId === runbookId);
  return result;
}

function resolveAlert(alertId, resolution) {
  const alert = alerts.get(alertId);
  if (!alert) return null;
  if (alert.status === "resolved") return { error: "already_resolved", alert };
  alert.status = "resolved";
  alert.resolvedAt = new Date().toISOString();
  alert.resolution = resolution || null;
  return { alert };
}

function resetStores() {
  runbooks.clear();
  observations.clear();
  alerts.clear();
  nextRunbookId = 1;
  nextObservationId = 1;
  nextAlertId = 1;
}

// --- Route factory ---
function createDriftRoutes(readBody, json) {
  return [
    // POST /drift/runbooks — create a runbook
    {
      method: "POST",
      pattern: /^\/drift\/runbooks$/,
      handler: async (req, res) => {
        let body;
        try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
        const errors = validateRunbook(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        json(res, 201, createRunbook(body));
      },
    },
    // GET /drift/runbooks — list all runbooks
    {
      method: "GET",
      pattern: /^\/drift\/runbooks$/,
      handler: (_req, res) => json(res, 200, listAllRunbooks()),
    },
    // GET /drift/runbooks/:id — get one runbook
    {
      method: "GET",
      pattern: /^\/drift\/runbooks\/([^/]+)$/,
      handler: (_req, res, match) => {
        const rb = getRunbook(match[1]);
        if (!rb) return json(res, 404, { error: "Runbook not found" });
        json(res, 200, rb);
      },
    },
    // POST /drift/runbooks/:id/observe — record an observation
    {
      method: "POST",
      pattern: /^\/drift\/runbooks\/([^/]+)\/observe$/,
      handler: async (req, res, match) => {
        if (!getRunbook(match[1])) return json(res, 404, { error: "Runbook not found" });
        let body;
        try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
        const errors = validateObservation(body);
        if (errors.length) return json(res, 400, { error: "Validation failed", details: errors });
        json(res, 201, recordObservation(match[1], body));
      },
    },
    // GET /drift/runbooks/:id/drift — drift report
    {
      method: "GET",
      pattern: /^\/drift\/runbooks\/([^/]+)\/drift$/,
      handler: (_req, res, match) => {
        const report = getDriftReport(match[1]);
        if (!report) return json(res, 404, { error: "Runbook not found" });
        json(res, 200, report);
      },
    },
    // GET /drift/alerts — list alerts (optional ?runbook_id= and ?status=all)
    {
      method: "GET",
      pattern: /^\/drift\/alerts(?:\?(.*))?$/,
      handler: (_req, res, match) => {
        const params = new URLSearchParams(match?.[1] || "");
        const rbId = params.get("runbook_id");
        const status = params.get("status");
        json(res, 200, status === "all" ? listAllAlerts(rbId) : listActiveAlerts(rbId));
      },
    },
    // PATCH /drift/alerts/:id/resolve — resolve an alert
    {
      method: "PATCH",
      pattern: /^\/drift\/alerts\/([^/]+)\/resolve$/,
      handler: async (req, res, match) => {
        let body = {};
        try { body = await readBody(req); } catch { return json(res, 400, { error: "Invalid JSON" }); }
        const result = resolveAlert(match[1], body.resolution);
        if (!result) return json(res, 404, { error: "Alert not found" });
        if (result.error === "already_resolved") return json(res, 409, { error: "Alert already resolved", alert: result.alert });
        json(res, 200, result.alert);
      },
    },
  ];
}

export {
  createDriftRoutes,
  createRunbook,
  getRunbook,
  listAllRunbooks,
  recordObservation,
  getDriftReport,
  listActiveAlerts,
  listAllAlerts,
  resolveAlert,
  detectDrifts,
  validateRunbook,
  validateObservation,
  resetStores,
  runbooks,
  observations,
  alerts,
};
