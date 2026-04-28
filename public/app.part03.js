ze="${escapeHtml(size.id)}" type="button">
        ${size.name}${priceLabel(size.price)}
      </button>
    `)
    .join("");

  const milkOptions = milks
    .map((milk) => `
      <option value="${escapeHtml(milk.id)}" ${state.custom.milkId === milk.id ? "selected" : ""}>
        ${escapeHtml(milk.name)}${priceLabel(milk.price)}
      </option>
    `)
    .join("");

  const syrupChoices = syrups.length
    ? syrups
        .map((syrup) => `
          <label>
            <input type="checkbox" data-syrup="${escapeHtml(syrup.id)}" ${state.custom.syrupIds.includes(syrup.id) ? "checked" : ""}>
            ${escapeHtml(syrup.name)}${priceLabel(syrup.price)}
          </label>
        `)
        .join("")
    : `<span class="small-muted">No syrups are active.</span>`;

  const addOnChoices = addOns.length
    ? addOns
        .map((addOn) => `
          <label>
            <input type="checkbox" data-addon="${escapeHtml(addOn.id)}" ${state.custom.addOnIds.includes(addOn.id) ? "checked" : ""}>
            ${escapeHtml(addOn.name)}${priceLabel(addOn.price)}
          </label>
        `)
        .join("")
    : `<span class="small-muted">No add-ons are active.</span>`;

  return `
    <div class="customizer-backdrop" data-close-customizer>
      <section class="customizer" role="dialog" aria-modal="true" aria-labelledby="customizerTitle">
        <header>
          <div>
            <h2 id="customizerTitle">${escapeHtml(item.name)}</h2>
            ${showPrices() ? `<span class="small-muted">${formatMoney(item.price)}</span>` : ""}
          </div>
          <button class="icon-button" data-close-customizer type="button" aria-label="Close">&times;</button>
        </header>
        <form id="customizerForm">
          <div class="field">
            <label>Size</label>
            <div class="choice-grid">${sizeButtons}</div>
          </div>
          <div class="field">
            <label for="milk">Milk</label>
            <select id="milk">${milkOptions}</select>
          </div>
          <div class="field">
            <label>Syrups</label>
            <div class="check-list">${syrupChoices}</div>
          </div>
          <div class="field">
            <label>Add-ons</label>
            <div class="check-list">${addOnChoices}</div>
          </div>
          <div class="field">
            <label for="itemNote">Note</label>
            <textarea id="itemNote" placeholder="Light ice, no foam, warmed, etc.">${escapeHtml(state.custom.note)}</textarea>
          </div>
          <div class="form-actions">
            <button class="secondary-button" data-close-customizer type="button">Cancel</button>
            <button class="primary-button" type="submit">Add To Order</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderDashboardView() {
  if (!state.adminAuthed) {
    return renderOwnerLoginView("Laptop dashboard");
  }

  const active = state.orders.filter((order) => order.status !== "complete");
  const completed = state.orders
    .filter((order) => order.status === "complete")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const columns = [
    ["new", "New"],
    ["making", "Making"],
    ["ready", "Ready"],
  ];

  const board = columns
    .map(([status, label]) => {
      const orders = active
        .filter((order) => order.status === status)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const tickets = orders.length
        ? orders.map((order) => renderTicket(order)).join("")
        : `<div class="empty-column">No ${label.toLowerCase()} orders.</div>`;

      return `
        <section class="queue-panel">
          <div class="panel-header">
            <h2 class="panel-title">${label}</h2>
            <span class="count-badge">${orders.length}</span>
          </div>
          <div class="ticket-list">${tickets}</div>
        </section>
      `;
    })
    .join("");

  const history = completed.length
    ? completed
        .slice(0, 14)
        .map((order) => `
          <div class="history-item">
            <div>
              <strong>#${String(order.ticketNumber).padStart(3, "0")} ${escapeHtml(order.customerName)}</strong>
              <div class="small-muted">${formatTime(order.updatedAt)}</div>
            </div>
            <span>${formatMoney(order.subtotal)}</span>
          </div>
        `)
        .join("")
    : `<div class="cart-empty">Completed orders will appear here.</div>`;

  const lanAddress = state.serverInfo?.addresses?.[0];
  const orderLink = lanAddress && state.serverInfo?.port
    ? `http://${lanAddress}:${state.serverInfo.port}/order`
    : `${window.location.origin}/order`;

  return `
    <div class="app">
      ${topbar("Laptop dashboard", `<a class="pill" href="/order">Order Screen</a><a class="pill" href="/portal">Owner Portal</a><span class="pill">${escapeHtml(orderLink)}</span>`)}
      <main class="screen dashboard-layout">
        <section class="board">${board}</section>
        <aside class="summary-panel">
          <h2 class="panel-title">Today</h2>
          <div class="summary-grid">
            <div class="metric">
              <span class="small-muted">Open</span>
              <strong>${active.length}</strong>
            </div>
            <div class="metric">
              <span class="small-muted">Ready</span>
              <strong>${state.orders.filter((order) => order.status === "ready").length}</strong>
            </div>
            <div class="metric">
              <span class="small-muted">Done</span>
              <strong>${completed.length}</strong>
            </div>
            <div class="metric">
              <span class="small-muted">Sales</span>
              <strong>${formatMoney(state.orders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0))}</strong>
            </div>
          </div>
          <div class="ticket-actions">
            <button class="secondary-button" id="refreshOrders" type="button">Refresh</button>
          </div>
          <h2 class="panel-title" style="margin-top: 22px;">Completed</h2>
          <div class="history-list">${history}</div>
        </aside>
      </main>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    </div>
  `;
}

function renderTicket(order) {
  const items = (order.items || [])
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span class="meta">${itemDetails(item)}</span>
      </li>
    `)
    .join("");
  const actions = {
    new: `
      <button class="primary-button" data-status="${order.id}:making" type="button">Start</button>
      <button class="secondary-button" data-status="${order.id}:ready" type="button">Ready</button>
    `,
    making: `
      <button class="secondary-button" data-status="${order.id}:new" type="button">Back</button>
      <button class="primary-button" data-status="${order.id}:ready" type="button">Ready</button>
    `,
    ready: 