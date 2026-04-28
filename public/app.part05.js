e="${escapeHtml(item.name)}">
          </div>
          <div class="field">
            <label>Extra Price</label>
            <input data-option-field="${key}:${index}:price" type="number" min="0" step="0.01" value="${Number(item.price || 0)}">
          </div>
          <button class="danger-button compact-button" data-remove-option="${key}:${index}" type="button">Remove</button>
        </div>
      </article>
    `)
    .join("");

  return `
    <div class="editor-list">
      ${rows}
      <button class="secondary-button add-editor-button" data-add-option="${key}" type="button">Add ${title}</button>
    </div>
  `;
}

function render() {
  const previousName = document.querySelector("#customerName")?.value || "";
  const note = document.querySelector("#itemNote")?.value;
  if (typeof note === "string") {
    state.custom.note = note;
  }

  if (state.view === "dashboard") {
    app.innerHTML = renderDashboardView();
  } else if (state.view === "portal") {
    app.innerHTML = renderPortalView();
  } else {
    app.innerHTML = renderOrderView();
  }

  const nameField = document.querySelector("#customerName");
  if (nameField && previousName) {
    nameField.value = previousName;
  }
}

function openCustomizer(itemId) {
  const item = activeMenu().find((entry) => entry.id === itemId);
  if (!item) return;

  const milks = activeOptions("milks");
  const defaultMilk = item.group === "food"
    ? milks.find((milk) => milk.name.toLowerCase() === "no milk") || milks[0]
    : milks.find((milk) => milk.name.toLowerCase().includes("whole")) || milks[0];
  const defaultSize = item.sizes.find((size) => size.active !== false && size.name.toLowerCase() === "regular") ||
    item.sizes.find((size) => size.active !== false) ||
    item.sizes[0];

  state.activeItem = item;
  state.custom = {
    sizeId: defaultSize?.id || "",
    milkId: defaultMilk?.id || "",
    syrupIds: [],
    addOnIds: [],
    note: "",
  };
  render();
}

function closeCustomizer() {
  state.activeItem = null;
  render();
}

function selectedOptions(key, selectedIds) {
  return state.catalog[key].filter((item) => selectedIds.includes(item.id));
}

function addCustomItem() {
  const item = state.activeItem;
  if (!item) return;

  const size = item.sizes.find((entry) => entry.id === state.custom.sizeId) ||
    item.sizes.find((entry) => entry.active !== false) ||
    { name: "Regular", price: 0 };
  const milk = state.catalog.milks.find((entry) => entry.id === state.custom.milkId);
  const syrups = selectedOptions("syrups", state.custom.syrupIds);
  const addOns = selectedOptions("addOns", state.custom.addOnIds);
  const optionsTotal =
    Number(size.price || 0) +
    Number(milk?.price || 0) +
    syrups.reduce((sum, syrup) => sum + Number(syrup.price || 0), 0) +
    addOns.reduce((sum, addOn) => sum + Number(addOn.price || 0), 0);
  const price = Math.max(0, Number(item.price || 0) + optionsTotal);

  state.cart.push({
    lineId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    id: item.id,
    name: item.name,
    size: size.name,
    milk: milk?.name || "",
    syrups: syrups.map((entry) => entry.name),
    addOns: addOns.map((entry) => entry.name),
    note: state.custom.note.trim(),
    price: Number(price.toFixed(2)),
  });

  state.activeItem = null;
  render();
}

async function submitOrder() {
  const nameField = document.querySelector("#customerName");
  const customerName = nameField?.value.trim();
  if (!customerName) {
    setToast("Add a customer name first.");
    nameField?.focus();
    return;
  }
  if (!state.cart.length) {
    setToast("Choose at least one item.");
    return;
  }

  state.submitting = true;
  render();

  try {
    const payload = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName,
        items: state.cart,
      }),
    });
    state.cart = [];
    state.lastTicket = payload.order.ticketNumber;
    setToast(`Order #${String(payload.order.ticketNumber).padStart(3, "0")} sent.`);
  } catch (error) {
    setToast(error.message);
  } finally {
    state.submitting = false;
    render();
  }
}

async function updateOrderStatus(id, status) {
  try {
    const payload = await api(`/api/orders/${id}`, {
      method: "PATCH",
      headers: state.adminPassword ? { "X-Capital-Admin-Password": state.adminPassword } : {},
      body: JSON.stringify({ status }),
    });
    state.orders = payload.orders || state.orders;
    render();
  } catch (error) {
    setToast(error.message);
  }
}

async function portalLogin(password) {
  try {
    const payload = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    state.adminPassword = password;
    state.adminAuthed = true;
    window.sessionStorage.setItem("capitalCoffeePortalPassword", password);
    state.catalog = normalizeCatalog(payload.catalog || state.catalog);
    if (state.view === "dashboard") {
      ensureOrdersPolling();
    }
    setToast("Portal unlocked.");
  } catch (error) {
    setToast(error.message);
  }
}

async function saveCatalog() {
  state.saving = true;
  render();

  try {
    const payload = await api("/api/admin/catalog", {
      method: "POST",
      headers: {
        "X-Capital-Admin-Password": state.adminPassword,
      },
      body: JSON.stringify(publicCatalogPayload()),
    });
    state.catalog = normalizeCatalog(payload.catalog || state.catalog);
    setToast("Catalog saved.");
  } catch (error) {
    setToast(error.message);
  } finally {
    state.saving = false;
    render();
  }
}

function addMenuItem() {
  state.catalog.menu.push({
    id: makeId("menu-item"),
    name: "New Item",
    group: "espresso",
    description: "",
    price: 0,
    art: "hot",
    active: true,
    sizes: defaultSizesForGroup("espresso"),
  });
  render();
}

function addOption(key) {
  state.catalog[key].push({
    id: makeId(key),
    name: "New Option",
    price: 0,
    active: true,
  });
  render();
}

function addSize(itemIndex) {
  const item = state.catalog.menu[Number(itemIndex)];
  if (!item) return;
  item.sizes.push({
    id: makeId("size"),
    name: "New Size",
    price: 0,
    active: true,
  });
  render();
}

app.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-group]");
  if (groupButton) {
    state.group = groupButton.dataset.group;
    render();
    return;
  }

  const portalTab = event.target.closest("[data-portal-tab]");
  if (portalTab) {
    state.portalTab = portalTab.dataset.portalTab;
    render();
    return;
  }

  const itemButton = event.target.closest("[data-open-item]");
  if (itemButton) {
    openCustomizer(itemButton.dataset.openItem);
    return;
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    state.cart.splice(Number(removeButton.dataset.remove), 1);
    render();
    return;
  }

  const closeButton = event.target.closest("[data-close-customizer]");