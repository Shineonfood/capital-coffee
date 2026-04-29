(() => {
  if (typeof state === "undefined" || state.view !== "order") return;

  state.customerName = state.customerName || "";

  function selectedOptions(key, selectedIds) {
    return state.catalog[key].filter((item) => selectedIds.includes(item.id));
  }

  function customItemTotal() {
    const item = state.activeItem;
    if (!item) return 0;
    const size = item.sizes.find((entry) => entry.id === state.custom.sizeId);
    const milk = state.catalog.milks.find((entry) => entry.id === state.custom.milkId);
    const syrups = selectedOptions("syrups", state.custom.syrupIds);
    const addOns = selectedOptions("addOns", state.custom.addOnIds);
    const total =
      Number(item.price || 0) +
      Number(size?.price || 0) +
      Number(milk?.price || 0) +
      syrups.reduce((sum, syrup) => sum + Number(syrup.price || 0), 0) +
      addOns.reduce((sum, addOn) => sum + Number(addOn.price || 0), 0);
    return Math.max(0, total);
  }

  renderOrderView = function renderIpadOrderView() {
    if (state.activeItem) {
      return `
        <div class="app order-app">
          ${topbar("iPad ordering", `<a class="pill" href="/dashboard">Dashboard</a><a class="pill" href="/portal">Owner Portal</a>`)}
          ${renderCustomizer()}
          ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
        </div>
      `;
    }

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
                <button class="menu-card order-menu-card" data-open-item="${item.id}" type="button">
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
      <div class="app order-app">
        ${topbar("iPad ordering", `<a class="pill" href="/dashboard">Dashboard</a><a class="pill" href="/portal">Owner Portal</a>`)}
        <main class="screen order-layout order-home-layout">
          <section class="menu-panel order-menu-panel">
            <div class="order-hero">
              <span class="eyebrow">Order screen</span>
              <h2>What can we make for you?</h2>
              <p>Choose a drink or food item, then customize it on the next screen.</p>
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
                <input id="customerName" autocomplete="off" placeholder="Customer name" value="${escapeHtml(state.customerName)}">
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
        ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
      </div>
    `;
  };

  renderCustomizer = function renderIpadCustomizer() {
    const item = state.activeItem;
    const milks = activeOptions("milks");
    const syrups = activeOptions("syrups");
    const addOns = activeOptions("addOns");
    const sizes = item.sizes.filter((size) => size.active !== false);

    const sizeButtons = sizes
      .map((size) => `
        <button class="option-pill ${state.custom.sizeId === size.id ? "selected" : ""}" data-size="${escapeHtml(size.id)}" type="button">
          ${escapeHtml(size.name)}${priceLabel(size.price)}
        </button>
      `)
      .join("");

    const milkOptions = milks.length
      ? milks
        .map((milk) => `
          <button class="option-pill ${state.custom.milkId === milk.id ? "selected" : ""}" data-milk="${escapeHtml(milk.id)}" type="button">
            ${escapeHtml(milk.name)}${priceLabel(milk.price)}
          </button>
        `)
        .join("")
      : `<span class="small-muted">No milks are active.</span>`;

    const flavorCards = syrups.length
      ? [
          { id: "", name: "No Flavor", selected: !state.custom.syrupIds.length, kind: "none", price: 0 },
          ...syrups.map((syrup) => ({
            id: syrup.id,
            name: syrup.name,
            selected: state.custom.syrupIds.includes(syrup.id),
            kind: syrup.name.toLowerCase().includes("vanilla") ? "citrus" : "bean",
            price: syrup.price,
          })),
        ].map((flavor) => `
          <button class="choice-card ${flavor.selected ? "selected" : ""}" data-flavor="${escapeHtml(flavor.id)}" type="button">
            <span class="line-art ${flavor.kind}">
              ${flavor.kind === "none" ? `
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <circle cx="40" cy="40" r="25"></circle>
                  <line x1="23" y1="57" x2="57" y2="23"></line>
                </svg>
              ` : flavor.kind === "citrus" ? `
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <circle cx="34" cy="33" r="18"></circle>
                  <path d="M34 15v36M16 33h36M21 20l26 26M47 20 21 46"></path>
                  <path d="M44 51c11 0 17 5 19 12M32 53c-2 7-8 11-15 12"></path>
                </svg>
              ` : `
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <ellipse cx="42" cy="39" rx="16" ry="28" transform="rotate(36 42 39)"></ellipse>
                  <path d="M22 57c11-12 25-23 40-35M35 57c8-9 17-17 27-25"></path>
                  <path d="M28 45c7 1 12 4 16 10M36 34c8 1 13 5 17 10"></path>
                </svg>
              `}
            </span>
            <strong>${escapeHtml(flavor.name)}${priceLabel(flavor.price)}</strong>
          </button>
        `).join("")
      : `<span class="small-muted">No syrups are active.</span>`;

    const addOnChoices = addOns.length
      ? addOns
        .map((addOn) => `
          <label class="option-pill ${state.custom.addOnIds.includes(addOn.id) ? "selected" : ""}">
            <input type="checkbox" data-addon="${escapeHtml(addOn.id)}" ${state.custom.addOnIds.includes(addOn.id) ? "checked" : ""}>
            ${escapeHtml(addOn.name)}${priceLabel(addOn.price)}
          </label>
        `)
        .join("")
      : `<span class="small-muted">No add-ons are active.</span>`;

    const cartSummary = state.cart.length
      ? state.cart
        .map((cartItem, index) => `
          <div class="mini-cart-line">
            <span>
              <strong>${escapeHtml(cartItem.name)}</strong>
              <small>${itemDetails(cartItem)}</small>
            </span>
            <button class="icon-button" data-remove="${index}" type="button" aria-label="Remove ${escapeHtml(cartItem.name)}">&times;</button>
          </div>
        `)
        .join("")
      : `<div class="mini-cart-empty">No items added yet.</div>`;

    return `
      <main class="screen ipad-flow-layout">
        <aside class="flow-rail">
          <div>
            <strong>Capital Coffee</strong>
            <span>Guest order</span>
          </div>
          <nav class="flow-steps" aria-label="Ordering steps">
            <button class="flow-step" type="button"><strong>1</strong>Drink</button>
            <button class="flow-step active" type="button"><strong>2</strong>Customize</button>
            <button class="flow-step" type="button"><strong>3</strong>Name</button>
            <button class="flow-step" type="button"><strong>4</strong>Send</button>
          </nav>
          <div class="flow-current-order">
            <strong>Current order</strong>
            ${cartSummary}
          </div>
        </aside>

        <section class="flow-builder" aria-labelledby="customizerTitle">
          <div class="flow-topline">
            <button class="back-link" data-close-customizer type="button">Back</button>
            <div class="top-actions">
              <span class="tiny-pill">${state.connected ? "Connected" : "Connecting"}</span>
              ${state.lastTicket ? `<span class="tiny-pill">Last #${String(state.lastTicket).padStart(3, "0")}</span>` : ""}
            </div>
          </div>

          <div class="flow-title">
            <span class="eyebrow">Customize</span>
            <h2 id="customizerTitle">${escapeHtml(item.name)}</h2>
            <p>${escapeHtml(item.description || "Choose a size, milk, flavor, and finishing touches.")}</p>
          </div>

          <section class="flow-section">
            <div class="flow-section-head">
              <h3>Size</h3>
              <span>${escapeHtml(sizes.find((size) => size.id === state.custom.sizeId)?.name || "Choose one")}</span>
            </div>
            <div class="pill-row">${sizeButtons}</div>
          </section>

          <section class="flow-section">
            <div class="flow-section-head">
              <h3>Flavor</h3>
              <span>Swipe for more</span>
            </div>
            <div class="choice-row">${flavorCards}</div>
          </section>

          <section class="flow-section">
            <div class="flow-section-head">
              <h3>Milk</h3>
              <span>${escapeHtml(milks.find((milk) => milk.id === state.custom.milkId)?.name || "Choose one")}</span>
            </div>
            <div class="pill-row">${milkOptions}</div>
          </section>

          <section class="flow-section">
            <div class="flow-section-head">
              <h3>Add-ons</h3>
              <span>Optional</span>
            </div>
            <div class="pill-row">${addOnChoices}</div>
          </section>

          <section class="flow-section">
            <div class="flow-section-head">
              <h3>Guest details</h3>
              <span>Used on the barista queue</span>
            </div>
            <div class="flow-form-grid">
              <div class="field underline-field">
                <label for="customerName">Name</label>
                <input id="customerName" autocomplete="off" placeholder="Customer name" value="${escapeHtml(state.customerName)}">
              </div>
              <div class="field underline-field">
                <label for="itemNote">Drink notes</label>
                <textarea id="itemNote" placeholder="Light ice, not too sweet, etc.">${escapeHtml(state.custom.note)}</textarea>
              </div>
            </div>
          </section>

          <div class="flow-bottom-bar">
            <div class="flow-summary">
              ${showPrices() ? `<strong>${formatMoney(customItemTotal())}</strong>` : ""}
              <span>${escapeHtml(sizes.find((size) => size.id === state.custom.sizeId)?.name || "Regular")} ${escapeHtml(item.name)}</span>
            </div>
            <button class="primary-button flow-add-button" id="addCustomItem" type="button">Add To Order</button>
          </div>
        </section>
      </main>
    `;
  };

  const baseRender = render;
  render = function renderWithIpadNameMemory() {
    const name = document.querySelector("#customerName")?.value;
    if (typeof name === "string") state.customerName = name;
    return baseRender();
  };

  app.addEventListener("click", (event) => {
    const addCustom = event.target.closest("#addCustomItem");
    if (addCustom) {
      state.customerName = document.querySelector("#customerName")?.value.trim() || state.customerName;
      state.custom.note = document.querySelector("#itemNote")?.value || state.custom.note;
      addCustomItem();
      return;
    }

    const milkButton = event.target.closest("[data-milk]");
    if (milkButton) {
      state.custom.milkId = milkButton.dataset.milk;
      render();
      return;
    }

    const flavorButton = event.target.closest("[data-flavor]");
    if (flavorButton) {
      const flavor = flavorButton.dataset.flavor;
      state.custom.syrupIds = flavor ? [flavor] : [];
      render();
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.matches("#customerName")) {
      state.customerName = event.target.value;
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.matches("[data-addon]")) {
      render();
    }
  });

  render();
})();
