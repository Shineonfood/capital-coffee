payload = await api("/api/catalog");
    state.catalog = normalizeCatalog(payload);
    state.catalogLoaded = true;
    render();
  } catch (error) {
    state.catalogLoaded = false;
    render();
  }
}

async function loadOrders() {
  try {
    const payload = await api("/api/orders", {
      headers: state.adminPassword ? { "X-Capital-Admin-Password": state.adminPassword } : {},
    });
    state.orders = payload.orders || [];
    state.connected = true;
    render();
  } catch (error) {
    state.connected = false;
    render();
  }
}

async function loadHealth() {
  try {
    state.serverInfo = await api("/api/health");
    state.connected = true;
    render();
  } catch (error) {
    state.serverInfo = null;
    state.connected = false;
    render();
  }
}

function startPolling() {
  loadHealth();
  loadCatalog();

  if (state.view === "dashboard" && state.adminAuthed) {
    ensureOrdersPolling();
  }

  window.setInterval(loadHealth, 30000);
  window.setInterval(loadCatalog, state.view === "portal" ? 30000 : 45000);
  window.setInterval(() => {
    if (state.view === "dashboard") {
      render();
    }
  }, 30000);
}

function ensureOrdersPolling() {
  if (state.ordersPollingStarted || state.view !== "dashboard" || !state.adminAuthed) return;
  state.ordersPollingStarted = true;
  loadOrders();
  window.setInterval(loadOrders, 1400);
}

function topbar(subtitle, actions = "") {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">${iconCup()}</div>
        <div>
          <h1>Capital Coffee</h1>
          <span>${escapeHtml(subtitle)}</span>
        </div>
      </div>
      <div class="top-actions">
        <span class="pill">
          <span class="status-dot ${state.connected ? "online" : ""}"></span>
          ${state.connected ? "Connected" : "Connecting"}
        </span>
        ${actions}
      </div>
    </header>
  `;
}

function renderOrderView() {
  const menu = activeMenu();
  const filteredMenu = state.group === "all" ? menu : menu.filter((item) => item.group === state.group);
  const groupButtons = groupOptions
    .map(([id, label]) => `
      <button class="segment-button ${state.group === id ? "active" : ""}" data-group="${id}" type="button">
        ${label}
      </button>
    `)
    .join("");

  const sections = categoryOptions
    .filter(([id]) => state.group === "all" || state.group === id)
    .map(([id, label]) => {
      const items = filteredMenu.filter((item) => item.group === id);
      if (!items.length && state.group !== id) return "";

      const cards = items.length
        ? items
            .map((item) => {
              const sizes = item.sizes.filter((size) => size.active !== false);
              const sizeText = sizes.length > 1
                ? sizes.map((size) => size.name).join(" / ")
                : sizes[0]?.name || "";
              return `
                <button class="menu-card" data-open-item="${item.id}" type="button">
                  <span>
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.description)}</p>
                  </span>
                  <span class="menu-card-footer">
                    <span>
                      ${showPrices() ? `<span class="price">${formatMoney(item.price)}</span>` : ""}
                      ${sizeText ? `<span class="size-hint">${escapeHtml(sizeText)}</span>` : ""}
                    </span>
                    <span class="add-chip">+</span>
                  </span>
                </button>
              `;
            })
            .join("")
        : `<div class="cart-empty">No active items in this category.</div>`;

      return `
        <section class="menu-section">
          <div class="menu-section-header">
            <h3>${label}</h3>
            <span>${items.length} item${items.length === 1 ? "" : "s"}</span>
          </div>
          <div class="menu-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  const cartLines = state.cart.length
    ? state.cart
        .map((item, index) => `
          <div class="cart-line">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${itemDetails(item)}</span>
            </div>
            <button class="icon-button" data-remove="${index}" type="button" aria-label="Remove ${escapeHtml(item.name)}">&times;</button>
          </div>
        `)
        .join("")
    : `<div class="cart-empty">Choose a drink to start an order.</div>`;

  const confirmation = state.lastTicket
    ? `
      <div class="confirmation">
        <strong>Order #${String(state.lastTicket).padStart(3, "0")} sent</strong>
        <span class="small-muted">It is now on the laptop dashboard.</span>
      </div>
    `
    : "";

  return `
    <div class="app">
      ${topbar("iPad ordering", `<a class="pill" href="/dashboard">Dashboard</a><a class="pill" href="/portal">Owner Portal</a>`)}
      <main class="screen order-layout">
        <section class="menu-panel">
          <div class="panel-header">
            <h2 class="panel-title">Menu</h2>
            <span class="small-muted">${state.catalogLoaded ? `${filteredMenu.length} items` : "Loading menu"}</span>
          </div>
          <div class="segmented">${groupButtons}</div>
          <div class="menu-sections">${sections || `<div class="cart-empty">No active menu items yet.</div>`}</div>
        </section>

        <aside class="cart-panel">
          <div class="panel-header">
            <h2 class="panel-title">Current Order</h2>
            <span class="small-muted">${state.cart.length} item${state.cart.length === 1 ? "" : "s"}</span>
          </div>
          <div class="cart-body">
            <div class="field">
              <label for="customerName">Name</label>
              <input id="customerName" autocomplete="off" placeholder="Customer name">
            </div>
            <div class="cart-items">${cartLines}</div>
            ${showPrices() ? `
              <div class="total-row">
                <span>Total</span>
                <span>${formatMoney(cartTotal())}</span>
              </div>
            ` : ""}
            <button class="primary-button" id="submitOrder" type="button" ${state.cart.length ? "" : "disabled"}>
              ${state.submitting ? "Sending..." : "Send Order"}
            </button>
          </div>
          ${confirmation}
        </aside>
      </main>
      ${state.activeItem ? renderCustomizer() : ""}
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderCustomizer() {
  const item = state.activeItem;
  const milks = activeOptions("milks");
  const syrups = activeOptions("syrups");
  const addOns = activeOptions("addOns");
  const sizes = item.sizes.filter((size) => size.active !== false);

  const sizeButtons = sizes
    .map((size) => `
      <button class="choice ${state.custom.sizeId === size.id ? "active" : ""}" data-si