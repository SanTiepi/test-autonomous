// Building Registry — in-memory store, validation, CRUD operations

const buildings = new Map();
let nextId = 1;

const VALID_TYPES = ["residential", "commercial", "industrial", "public", "mixed"];
const VALID_RISK_LEVELS = ["low", "medium", "high", "critical"];

// --- Validation ---

export function validateBuilding(body) {
  const errors = [];

  if (typeof body.address !== "string" || body.address.trim().length === 0) {
    errors.push("address: required non-empty string");
  } else if (body.address.length > 500) {
    errors.push("address: must be 500 chars or fewer");
  }

  if (typeof body.type !== "string" || !VALID_TYPES.includes(body.type)) {
    errors.push(`type: required, one of ${VALID_TYPES.join(", ")}`);
  }

  if (typeof body.year !== "number" || !Number.isInteger(body.year)) {
    errors.push("year: required integer");
  } else if (body.year < 1000 || body.year > new Date().getFullYear()) {
    errors.push(`year: must be between 1000 and ${new Date().getFullYear()}`);
  }

  if (typeof body.risk_level !== "string" || !VALID_RISK_LEVELS.includes(body.risk_level)) {
    errors.push(`risk_level: required, one of ${VALID_RISK_LEVELS.join(", ")}`);
  }

  return errors;
}

// --- CRUD ---

export function createBuilding(data) {
  const id = String(nextId++);
  const building = {
    id,
    address: data.address.trim(),
    type: data.type,
    year: data.year,
    risk_level: data.risk_level,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  buildings.set(id, building);
  return building;
}

export function getBuilding(id) {
  return buildings.get(id) || null;
}

export function listBuildings() {
  return [...buildings.values()];
}

export function updateBuilding(id, data) {
  const building = buildings.get(id);
  if (!building) return null;
  building.address = data.address.trim();
  building.type = data.type;
  building.year = data.year;
  building.risk_level = data.risk_level;
  building.updated_at = new Date().toISOString();
  return building;
}

export function deleteBuilding(id) {
  return buildings.delete(id);
}

// --- Store management (for testing) ---

export function clearBuildings() {
  buildings.clear();
  nextId = 1;
}

export { buildings, VALID_TYPES, VALID_RISK_LEVELS };
