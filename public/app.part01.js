const categoryOptions = [
  ["espresso", "Espresso Drinks"],
  ["coffee", "Coffee Drinks"],
  ["tea", "Teas"],
  ["food", "Food"],
];

const groupOptions = [["all", "All"], ...categoryOptions];

const defaultDrinkSizes = [
  { id: "small", name: "Small", price: -0.35, active: true },
  { id: "regular", name: "Regular", price: 0, active: true },
  { id: "large", name: "Large", price: 0.75, active: true },
];

const defaultFoodSizes = [
  { id: "regular", name: "Regular", price: 0, active: true },
];

const fallbackCatalog = {
  showPrice: true,
  menu: [],
  milks: [],
  syrups: [],
  addOns: [],
  updatedAt: "",
};

const path = window.location.pathname;

const state = {
  view: path.includes("portal") ? "portal" : path.includes("dashboard") ? "dashboard" : "order",
  group: "all",
  cart: [],
  orders: [],
  catalog: fallbackCatalog,
  catalogLoaded: false,
  serverInfo: null,
  activeItem: null,
  custom: {
    sizeId: "",
    milkId: "",
    syrupIds: [],
    addOnIds: [],
    note: "",
  },
  portalTab: "menu",
  adminPassword: window.sessionStorage.getItem("capitalCoffeePortalPassword") || "",
  adminAuthed: Boolean(window.sessionStorage.getItem("capitalCoffeePortalPassword")),
  lastTicket: null,
  connected: false,
  submitting: false,
  saving: false,
  ordersPollingStarted: false,
  toast: "",
};

const app = document.querySelector("#app");

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function iconCup() {
  return `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path fill="currentColor" d="M8 12h14v7.5A7.5 7.5 0 0 1 14.5 27h-.1A7.4 7.4 0 0 1 7 19.6V13a1 1 0 0 1 1-1Zm15 2h2a4 4 0 0 1 0 8h-2v-2h2a2 2 0 0 0 0-4h-2v-2ZM12 5.5c0-1.7 2-2.2 2-3.8h2c0 2.4-2 2.9-2 4.1 0 .7.4 1.1.9 1.8l-1.6 1.2C12.5 7.8 12 7 12 5.5Zm6 0c0-1.7 2-2.2 2-3.8h2c0 2.4-2 2.9-2 4.1 0 .7.4 1.1.9 1.8l-1.6 1.2C18.5 7.8 18 7 18 5.5Z"/>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeId(value) {
  const base = String(value || "item")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "item"}-${Date.now().toString(36)}`;
}

function normalizeGroup(group) {
  if (group === "brewed" || group === "cold") return "coffee";
  if (group === "espresso" || group === "coffee" || group === "tea" || group === "food") return group;
  return "coffee";
}

function defaultSizesForGroup(group) {
  return (group === "food" ? defaultFoodSizes : defaultDrinkSizes).map((size) => ({ ...size }));
}

function normalizeSizes(item) {
  const group = normalizeGroup(item?.group);
  const rawSizes = Array.isArray(item?.sizes) && item.sizes.length ? item.sizes : defaultSizesForGroup(group);
  const sizes = rawSizes.map((size, index) => ({
    id: size.id || makeId(size.name || `size-${index + 1}`),
    name: size.name || `Size ${index + 1}`,
    price: Number(size.price || 0),
    active: size.active !== false,
  }));

  if (!sizes.some((size) => size.active !== false)) {
    sizes[0].active = true;
  }

  return sizes;
}

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function priceLabel(value) {
  if (state.catalog.showPrice === false) return "";
  const amount = Number(value || 0);
  if (amount === 0) return "";
  return ` +${formatMoney(amount)}`;
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function minutesSince(value) {
  if (!value) return "now";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

function normalizeCatalog(catalog) {
  const next = {
    menu: Array.isArray(catalog?.menu) ? catalog.menu : [],
    milks: Array.isArray(catalog?.milks) ? catalog.milks : [],
    syrups: Array.isArray(catalog?.syrups) ? catalog.syrups : [],
    addOns: Array.isArray(catalog?.addOns) ? catalog.addOns : [],
    showPrice: catalog?.showPrice !== false,
    updatedAt: catalog?.updatedAt || "",
  };

  next.menu = next.menu.map((item, index) => ({
    id: item.id || makeId(item.name || `menu-${index + 1}`),
    name: item.name || "New item",
    group: normalizeGroup(item.group),
    description: item.description || "",
    price: Number(item.price || 0),
    art: item.art || "hot",
    active: item.active !== false,
    sizes: normalizeSizes(item),
  }));

  for (const key of ["milks", "syrups", "addOns"]) {
    next[key] = next[key].map((item, index) => ({
      id: item.id || makeId(item.name || `${key}-${index + 1}`),
      name: item.name || "New option",
      price: Number(item.price || 0),
      active: item.active !== false,
    }));
  }

  return next;
}

function publicCatalogPayload() {
  return normalizeCatalog({
    menu: state.catalog.menu,
    milks: state.catalog.milks,
    syrups: state.catalog.syrups,
    addOns: state.catalog.addOns,
    showPrice: state.catalog.showPrice !== false,
    updatedAt: state.catalog.updatedAt,
  });
}

function activeMenu() {
  return state.catalog.menu.filter((item) => item.active !== false);
}

function activeOptions(key) {
  return state.catalog[key].filter((item) => item.active !== false);
}

function showPrices() {
  return state.catalog.showPrice !== false;
}

function categoryLabel(group) {
  return categoryOptions.find(([id]) => id === normalizeGroup(group))?.[1] || group || "Menu";
}

function cartTotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function itemDetails(item) {
  const details = [];
  if (item.size) details.push(escapeHtml(item.size));
  if (item.milk) details.push(escapeHtml(item.milk));
  if (item.shots) details.push(escapeHtml(item.shots));
  if (item.syrups?.length) details.push(item.syrups.map(escapeHtml).join(", "));
  if (item.addOns?.length) details.push(item.addOns.map(escapeHtml).join(", "));
  if (item.extras?.length) details.push(item.extras.map(escapeHtml).join(", "));
  if (item.note) details.push(escapeHtml(item.note));
  return details.filter(Boolean).join(" &middot; ");
}

function setToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Something went wrong.");
  }

  return response.json();
}

async function loadCatalog() {
  try {
    const 