// --- In-memory bookmark store ---
const bookmarks = new Map();
let nextBookmarkId = 1;

function validateBookmark(body) {
  const errors = [];
  if (typeof body.url !== "string" || body.url.trim().length < 1) {
    errors.push("url: required non-empty string");
  }
  if (typeof body.title !== "string" || body.title.trim().length < 1) {
    errors.push("title: required non-empty string");
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      errors.push("tags: must be an array");
    } else if (!body.tags.every((t) => typeof t === "string")) {
      errors.push("tags: all items must be strings");
    }
  }
  return errors;
}

function createBookmark(body) {
  const id = String(nextBookmarkId++);
  const bookmark = {
    id,
    url: body.url.trim(),
    title: body.title.trim(),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => t.trim()) : [],
    created_at: new Date().toISOString(),
  };
  bookmarks.set(id, bookmark);
  return bookmark;
}

function getBookmarkById(id) {
  return bookmarks.get(id) || null;
}

function listBookmarks(tag, page = 1, limit = 20) {
  let all = [...bookmarks.values()];
  if (tag) {
    const lower = tag.toLowerCase();
    all = all.filter(b => b.tags.some(t => t.toLowerCase() === lower));
  }
  const total = all.length;
  const start = (page - 1) * limit;
  const data = all.slice(start, start + limit);
  return { data, page, limit, total };
}

function updateBookmark(id, body) {
  const existing = bookmarks.get(id);
  if (!existing) return null;
  existing.url = body.url.trim();
  existing.title = body.title.trim();
  existing.tags = Array.isArray(body.tags) ? body.tags.map((t) => t.trim()) : [];
  return existing;
}

function deleteBookmark(id) {
  if (!bookmarks.has(id)) return false;
  bookmarks.delete(id);
  return true;
}

function importBookmarks(items) {
  if (!Array.isArray(items)) {
    return { error: "Body must be a JSON array", details: [], created: null };
  }
  const allErrors = [];
  for (let i = 0; i < items.length; i++) {
    const errors = validateBookmark(items[i] || {});
    if (errors.length) allErrors.push({ index: i, errors });
  }
  if (allErrors.length) {
    return { error: "Validation failed", details: allErrors, created: null };
  }
  const created = items.map(item => createBookmark(item));
  return { error: null, details: [], created };
}

function exportBookmarks() {
  return [...bookmarks.values()];
}

function getRecentBookmarks(n = 5) {
  return [...bookmarks.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || Number(b.id) - Number(a.id))
    .slice(0, n);
}

function getBookmarkStats() {
  const all = [...bookmarks.values()];
  const total = all.length;
  const by_tag = {};
  for (const b of all) {
    // Count unique tags per bookmark (dedupe within same bookmark)
    const uniqueTags = [...new Set(b.tags)];
    for (const t of uniqueTags) {
      by_tag[t] = (by_tag[t] || 0) + 1;
    }
  }
  let oldest = null, newest = null;
  for (const b of all) {
    if (!b.created_at) continue; // skip bookmarks without timestamp
    if (!oldest || b.created_at < oldest.created_at) oldest = b;
    if (!newest || b.created_at > newest.created_at) newest = b;
  }
  return { total, by_tag, oldest, newest };
}

export { bookmarks, validateBookmark, createBookmark, getBookmarkById, listBookmarks, updateBookmark, deleteBookmark, importBookmarks, exportBookmarks, getBookmarkStats, getRecentBookmarks };
