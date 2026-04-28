import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(__dirname, "public");
const dataRoot = path.join(__dirname, "data");
const localOrdersPath = path.join(dataRoot, "orders.json");
const localCatalogPath = path.join(dataRoot, "catalog.json");
const port = Number(process.env.PORT || 4173);

const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const hasSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);

const defaultCatalog = await loadDefaultCatalog();
const adminPassword = process.env.ADMIN_PASSWORD || defaultCatalog.adminPassword || "capitalcoffee";

function parseJsonText(raw) {
  return JSON.parse(String(raw || "").replace(/^\uFEFF/, ""));
}

async function loadDefaultCatalog() {
  try {
    const raw = await readFile(localCatalogPath, "utf8");
    return normalizeCatalog(parseJsonText(raw));
  } catch {
    return normalizeCatalog({
      adminPassword: "capitalcoffee",
      showPrice: true,
      menu: [],
      milks: [],
      syrups: [],
      addOns: [],
      updatedAt: "",
    });
  }
}

function normalizeCatalog(catalog) {
  return {
    adminPassword: catalog?.adminPassword || "capitalcoffee",
    showPrice: catalog?.showPrice !== false,
    menu: Array.isArray(catalog?.menu) ? catalog.menu : [],
    milks: Array.isArray(catalog?.milks) ? catalog.milks : [],
    syrups: Array.isArray(catalog?.syrups) ? catalog.syrups : [],
    addOns: Array.isArray(catalog?.addOns) ? catalog.addOns : [],
    updatedAt: catalog?.updatedAt || "",
  };
}

function publicCatalog(catalog) {
  const normalized = normalizeCatalog(catalog);
  return {
    showPrice: normalized.showPrice,
    menu: normalized.menu,
    milks: normalized.milks,
    syrups: normalized.syrups,
    addOns: normalized.addOns,
    updatedAt: normalized.updatedAt,
  };
}

function mergeWithDefaultCatalog(saved) {
  return normalizeCatalog({
    ...defaultCatalog,
    ...saved,
    menu: Array.isArray(saved?.menu) && saved.menu.length ? saved.menu : defaultCatalog.menu,
    milks: Array.isArray(saved?.milks) && saved.milks.length ? saved.milks : defaultCatalog.milks,
    syrups: Array.isArray(saved?.syrups) && saved.syrups.length ? saved.syrups : defaultCatalog.syrups,
    addOns: Array.isArray(saved?.addOns) && saved.addOns.length ? saved.addOns : defaultCatalog.addOns,
  });
}

function jsonResponse(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload, null, 2));
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
  });
  response.end(body);
}

function textResponse(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  const bytes = Buffer.from(body);
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": bytes.length,
    "cache-control": "no-store",
  });
  response.end(bytes);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
  }[ext] || "application/octet-stream";
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

async function supabaseFetch(table, query = "", options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    ...options,
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase request failed: ${response.status}`);
  }

  return payload;
}

async function ensureLocalData() {
  await mkdir(dataRoot, { recursive: true });
  if (!existsSync(localOrdersPath)) {
    await writeFile(localOrdersPath, JSON.stringify({ orders: [] }, null, 2));
  }
  if (!existsSync(localCatalogPath)) {
    await writeFile(localCatalogPath, JSON.stringify(defaultCatalog, null, 2));
  }
}

async function getCatalog() {
  if (hasSupabase) {
    const rows = await supabaseFetch("app_settings", "?key=eq.catalog&select=value&limit=1");
    if (rows?.[0]?.value) return mergeWithDefaultCatalog(rows[0].value);
    await saveCatalog(publicCatalog(defaultCatalog));
    return defaultCatalog;
  }

  await ensureLocalData();
  const raw = await readFile(localCatalogPath, "utf8");
  return normalizeCatalog(parseJsonText(raw));
}

async function saveCatalog(catalog) {
  const next = {
    ...publicCatalog(catalog),
    updatedAt: new Date().toISOString(),
  };

  if (hasSupabase) {
    await supabaseFetch("app_settings", "", {
      method: "POST",
      headers: {
        prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([{ key: "catalog", value: next }]),
    });
  } else {
    await ensureLocalData();
    await writeFile(localCatalogPath, JSON.stringify({ adminPassword, ...next }, null, 2));
  }

  return next;
}

async function getOrders() {
  if (hasSupabase) {
    const rows = await supabaseFetch("orders", "?select=*&order=created_at.asc");
    return rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      customerName: row.customer_name,
      status: row.status,
      items: row.items || [],
      subtotal: Number(row.subtotal || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  await ensureLocalData();
  const raw = await readFile(localOrdersPath, "utf8");
  return parseJsonText(raw || "{\"orders\":[]}").orders || [];
}

async function writeLocalOrders(orders) {
  await ensureLocalData();
  await writeFile(localOrdersPath, JSON.stringify({ orders }, null, 2));
}

function todayPrefix() {
  return new Date().toISOString().slice(0, 10);
}

function nextTicketNumber(orders) {
  const today = todayPrefix();
  const numbers = orders
    .filter((order) => String(order.createdAt || "").startsWith(today))
    .map((order) => Number(order.ticketNumber || 0));
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

async function createOrder(body) {
  if (!body?.customerName?.trim() || !Array.isArray(body.items) || body.items.length === 0) {
    const error = new Error("Customer name and at least one item are required.");
    error.statusCode = 400;
    throw error;
  }

  const orders = await getOrders();
  const now = new Date().toISOString();
  const subtotal = body.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const order = {
    id: crypto.randomUUID().replaceAll("-", ""),
    ticketNumber: nextTicketNumber(orders),
    customerName: String(body.customerName).trim(),
    status: "new",
    items: body.items,
    subtotal: Number(subtotal.toFixed(2)),
    createdAt: now,
    updatedAt: now,
  };

  if (hasSupabase) {
    await supabaseFetch("orders", "", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify([{
        id: order.id,
        ticket_number: order.ticketNumber,
        customer_name: order.customerName,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      }]),
    });
  } else {
    await writeLocalOrders([...orders, order]);
  }

  return order;
}

async function updateOrderStatus(id, status) {
  const allowed = new Set(["new", "making", "ready", "complete"]);
  if (!allowed.has(status)) {
    const error = new Error("Invalid order status.");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();

  if (hasSupabase) {
    const rows = await supabaseFetch(`orders?id=eq.${encodeURIComponent(id)}`, "", {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ status, updated_at: now }),
    });
    if (!rows?.length) {
      const error = new Error("Order not found.");
      error.statusCode = 404;
      throw error;
    }
    return getOrders();
  }

  const orders = await getOrders();
  const order = orders.find((entry) => entry.id === id);
  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  order.status = status;
  order.updatedAt = now;
  await writeLocalOrders(orders);
  return orders;
}

function passwordFrom(request, body) {
  return request.headers["x-capital-admin-password"] || body?.password || "";
}

function requireAdmin(request, body) {
  if (passwordFrom(request, body) !== adminPassword) {
    const error = new Error("Incorrect portal password.");
    error.statusCode = 401;
    throw error;
  }
}

async function handleApi(request, response, url) {
  const body = ["POST", "PATCH", "PUT"].includes(request.method || "") ? await readBody(request) : null;

  if (request.method === "GET" && url.pathname === "/api/health") {
    jsonResponse(response, 200, {
      ok: true,
      app: "Capital Coffee",
      mode: hasSupabase ? "hosted" : "local",
      time: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/catalog") {
    jsonResponse(response, 200, publicCatalog(await getCatalog()));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    requireAdmin(request, body);
    jsonResponse(response, 200, { ok: true, catalog: publicCatalog(await getCatalog()) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/catalog") {
    requireAdmin(request, body);
    if (!body?.menu || !body?.milks || !body?.syrups || !body?.addOns) {
      const error = new Error("Menu, milks, syrups, and add-ons are required.");
      error.statusCode = 400;
      throw error;
    }
    jsonResponse(response, 200, { ok: true, catalog: await saveCatalog(body) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/orders") {
    requireAdmin(request, body);
    jsonResponse(response, 200, { orders: await getOrders(), serverTime: new Date().toISOString() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    jsonResponse(response, 201, { order: await createOrder(body) });
    return;
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (request.method === "PATCH" && orderMatch) {
    requireAdmin(request, body);
    jsonResponse(response, 200, { orders: await updateOrderStatus(orderMatch[1], body?.status) });
    return;
  }

  jsonResponse(response, 404, { error: "API route not found." });
}

async function serveStatic(response, url) {
  let routePath = decodeURIComponent(url.pathname);
  if (routePath === "/") routePath = "/order";

  if (routePath === "/app.js") {
    const chunks = [];
    for (let index = 1; ; index += 1) {
      const chunkPath = path.join(publicRoot, `app.part${String(index).padStart(2, "0")}.js`);
      if (!existsSync(chunkPath)) break;
      chunks.push(await readFile(chunkPath));
    }

    if (chunks.length) {
      const bytes = Buffer.concat(chunks);
      response.writeHead(200, {
        "content-type": contentTypeFor(routePath),
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      response.end(bytes);
      return;
    }
  }

  const filePath = ["/order", "/dashboard", "/portal"].includes(routePath)
    ? path.join(publicRoot, "index.html")
    : path.join(publicRoot, routePath.replace(/^\/+/, ""));

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(publicRoot))) {
    jsonResponse(response, 404, { error: "Not found." });
    return;
  }

  try {
    const bytes = await readFile(resolved);
    response.writeHead(200, {
      "content-type": contentTypeFor(resolved),
      "content-length": bytes.length,
      "cache-control": "no-store",
    });
    response.end(bytes);
  } catch {
    jsonResponse(response, 404, { error: "File not found." });
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
        "access-control-allow-headers": "Content-Type, X-Capital-Admin-Password",
      });
      response.end();
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(response, url);
      return;
    }

    textResponse(response, 405, "Method not allowed.");
  } catch (error) {
    jsonResponse(response, error.statusCode || 500, { error: error.message || "Server error." });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Capital Coffee listening on port ${port}`);
});
