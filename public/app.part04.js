`
      <button class="secondary-button" data-status="${order.id}:making" type="button">Back</button>
      <button class="primary-button" data-status="${order.id}:complete" type="button">Complete</button>
    `,
  };

  return `
    <article class="ticket ${escapeHtml(order.status)}">
      <div class="ticket-top">
        <div>
          <strong>${escapeHtml(order.customerName)}</strong>
          <div class="meta">${formatTime(order.createdAt)} &middot; ${minutesSince(order.createdAt)}</div>
        </div>
        <span class="ticket-number">#${String(order.ticketNumber).padStart(3, "0")}</span>
      </div>
      <ul>${items}</ul>
      <div class="ticket-actions">${actions[order.status] || ""}</div>
    </article>
  `;
}

function renderPortalView() {
  const actions = state.adminAuthed
    ? `<a class="pill" href="/dashboard">Dashboard</a><a class="pill" href="/order">Order Screen</a><button class="secondary-button compact-button" id="logoutPortal" type="button">Log Out</button>`
    : `<a class="pill" href="/dashboard">Dashboard</a><a class="pill" href="/order">Order Screen</a>`;

  if (!state.adminAuthed) {
    return renderOwnerLoginView("Owner portal");
  }

  const tabs = [
    ["menu", "Menu"],
    ["milks", "Milks"],
    ["syrups", "Syrups"],
    ["addOns", "Add-ons"],
  ]
    .map(([id, label]) => `
      <button class="segment-button ${state.portalTab === id ? "active" : ""}" data-portal-tab="${id}" type="button">${label}</button>
    `)
    .join("");

  return `
    <div class="app">
      ${topbar("Owner portal", actions)}
      <main class="screen portal-layout">
        <section class="portal-main">
          <div class="panel-header portal-heading">
            <div>
              <h2 class="panel-title">Customize Ordering</h2>
              <span class="small-muted">Saved changes update the iPad order screen.</span>
            </div>
            <button class="primary-button save-button" id="saveCatalog" type="button">${state.saving ? "Saving..." : "Save Changes"}</button>
          </div>
          <div class="portal-setting-row">
            <div>
              <strong>Show Prices</strong>
              <span class="small-muted">Display prices and totals on the order screen.</span>
            </div>
            <label class="switch-control">
              <input type="checkbox" id="showPriceToggle" ${showPrices() ? "checked" : ""}>
              <span></span>
            </label>
          </div>
          <div class="segmented portal-tabs">${tabs}</div>
          ${state.portalTab === "menu" ? renderMenuEditor() : renderOptionEditor(state.portalTab)}
        </section>
      </main>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderOwnerLoginView(subtitle) {
  const actions = `<a class="pill" href="/order">Order Screen</a>`;
  return `
    <div class="app">
      ${topbar(subtitle, actions)}
      <main class="screen portal-login-layout">
        <section class="cart-panel portal-login">
          <div class="panel-header">
            <h2 class="panel-title">Sign In</h2>
          </div>
          <form class="cart-body" id="portalLoginForm">
            <div class="field">
              <label for="portalPassword">Password</label>
              <input id="portalPassword" type="password" autocomplete="current-password" placeholder="Owner password">
            </div>
            <button class="primary-button" type="submit">Continue</button>
          </form>
        </section>
      </main>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderSizeEditor(item, itemIndex) {
  const rows = item.sizes
    .map((size, sizeIndex) => `
      <div class="size-editor-row">
        <label class="toggle-row">
          <input type="checkbox" data-size-active="${itemIndex}:${sizeIndex}" ${size.active !== false ? "checked" : ""}>
          Active
        </label>
        <input aria-label="Size name" data-size-field="${itemIndex}:${sizeIndex}:name" value="${escapeHtml(size.name)}">
        <input aria-label="Size price" data-size-field="${itemIndex}:${sizeIndex}:price" type="number" step="0.01" value="${Number(size.price || 0)}">
        <button class="danger-button compact-button" data-remove-size="${itemIndex}:${sizeIndex}" type="button">Remove</button>
      </div>
    `)
    .join("");

  return `
    <div class="wide-field size-editor">
      <div class="size-editor-header">
        <label>Sizes For This Item</label>
        <button class="secondary-button compact-button" data-add-size="${itemIndex}" type="button">Add Size</button>
      </div>
      <div class="size-editor-list">${rows}</div>
    </div>
  `;
}

function renderMenuEditor() {
  const rows = state.catalog.menu
    .map((item, index) => `
      <article class="editor-row">
        <div class="editor-row-top">
          <label class="toggle-row">
            <input type="checkbox" data-menu-active="${index}" ${item.active !== false ? "checked" : ""}>
            Active
          </label>
          <button class="danger-button compact-button" data-remove-menu="${index}" type="button">Remove</button>
        </div>
        <div class="editor-grid menu-editor-grid">
          <div class="field">
            <label>Name</label>
            <input data-menu-field="${index}:name" value="${escapeHtml(item.name)}">
          </div>
          <div class="field">
            <label>Price</label>
            <input data-menu-field="${index}:price" type="number" min="0" step="0.01" value="${Number(item.price || 0)}">
          </div>
          <div class="field">
            <label>Category</label>
            <select data-menu-field="${index}:group">
              ${categoryOptions.map(([id, label]) => `<option value="${id}" ${item.group === id ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </div>
          <div class="field wide-field">
            <label>Description</label>
            <textarea data-menu-field="${index}:description">${escapeHtml(item.description)}</textarea>
          </div>
          ${renderSizeEditor(item, index)}
        </div>
      </article>
    `)
    .join("");

  return `
    <div class="editor-list">
      ${rows}
      <button class="secondary-button add-editor-button" id="addMenuItem" type="button">Add Menu Item</button>
    </div>
  `;
}

function renderOptionEditor(key) {
  const title = key === "addOns" ? "Add-on" : key.slice(0, -1);
  const rows = state.catalog[key]
    .map((item, index) => `
      <article class="editor-row option-editor-row">
        <label class="toggle-row">
          <input type="checkbox" data-option-active="${key}:${index}" ${item.active !== false ? "checked" : ""}>
          Active
        </label>
        <div class="editor-grid option-editor-grid">
          <div class="field">
            <label>Name</label>
            <input data-option-field="${key}:${index}:name" valu