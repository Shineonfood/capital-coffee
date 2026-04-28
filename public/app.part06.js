
  if (closeButton && (event.target === closeButton || closeButton.matches("button"))) {
    closeCustomizer();
    return;
  }

  const sizeButton = event.target.closest("[data-size]");
  if (sizeButton) {
    state.custom.sizeId = sizeButton.dataset.size;
    render();
    return;
  }

  const submit = event.target.closest("#submitOrder");
  if (submit) {
    submitOrder();
    return;
  }

  const statusButton = event.target.closest("[data-status]");
  if (statusButton) {
    const [id, status] = statusButton.dataset.status.split(":");
    updateOrderStatus(id, status);
    return;
  }

  const refresh = event.target.closest("#refreshOrders");
  if (refresh) {
    loadOrders();
    return;
  }

  const save = event.target.closest("#saveCatalog");
  if (save) {
    saveCatalog();
    return;
  }

  const addMenu = event.target.closest("#addMenuItem");
  if (addMenu) {
    addMenuItem();
    return;
  }

  const addOptionButton = event.target.closest("[data-add-option]");
  if (addOptionButton) {
    addOption(addOptionButton.dataset.addOption);
    return;
  }

  const removeMenuButton = event.target.closest("[data-remove-menu]");
  if (removeMenuButton) {
    state.catalog.menu.splice(Number(removeMenuButton.dataset.removeMenu), 1);
    render();
    return;
  }

  const addSizeButton = event.target.closest("[data-add-size]");
  if (addSizeButton) {
    addSize(addSizeButton.dataset.addSize);
    return;
  }

  const removeSizeButton = event.target.closest("[data-remove-size]");
  if (removeSizeButton) {
    const [itemIndex, sizeIndex] = removeSizeButton.dataset.removeSize.split(":");
    const item = state.catalog.menu[Number(itemIndex)];
    if (item) {
      item.sizes.splice(Number(sizeIndex), 1);
      if (!item.sizes.length) {
        item.sizes = defaultSizesForGroup(item.group);
      }
    }
    render();
    return;
  }

  const removeOptionButton = event.target.closest("[data-remove-option]");
  if (removeOptionButton) {
    const [key, index] = removeOptionButton.dataset.removeOption.split(":");
    state.catalog[key].splice(Number(index), 1);
    render();
    return;
  }

  const logout = event.target.closest("#logoutPortal");
  if (logout) {
    state.adminAuthed = false;
    state.adminPassword = "";
    window.sessionStorage.removeItem("capitalCoffeePortalPassword");
    render();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.matches("#milk")) {
    state.custom.milkId = event.target.value;
  }

  if (event.target.matches("#showPriceToggle")) {
    state.catalog.showPrice = event.target.checked;
    render();
  }

  if (event.target.matches("[data-syrup]")) {
    const syrup = event.target.dataset.syrup;
    if (event.target.checked) {
      state.custom.syrupIds = [...new Set([...state.custom.syrupIds, syrup])];
    } else {
      state.custom.syrupIds = state.custom.syrupIds.filter((entry) => entry !== syrup);
    }
  }

  if (event.target.matches("[data-addon]")) {
    const addOn = event.target.dataset.addon;
    if (event.target.checked) {
      state.custom.addOnIds = [...new Set([...state.custom.addOnIds, addOn])];
    } else {
      state.custom.addOnIds = state.custom.addOnIds.filter((entry) => entry !== addOn);
    }
  }

  if (event.target.matches("[data-menu-active]")) {
    state.catalog.menu[Number(event.target.dataset.menuActive)].active = event.target.checked;
  }

  if (event.target.matches("select[data-menu-field]")) {
    const [index, field] = event.target.dataset.menuField.split(":");
    const item = state.catalog.menu[Number(index)];
    item[field] = field === "price" ? Number(event.target.value || 0) : event.target.value;
    if (field === "group") {
      item.group = normalizeGroup(item.group);
      if (!item.sizes?.length) {
        item.sizes = defaultSizesForGroup(item.group);
      }
    }
  }

  if (event.target.matches("[data-size-active]")) {
    const [itemIndex, sizeIndex] = event.target.dataset.sizeActive.split(":");
    const item = state.catalog.menu[Number(itemIndex)];
    if (item?.sizes?.[Number(sizeIndex)]) {
      item.sizes[Number(sizeIndex)].active = event.target.checked;
    }
  }

  if (event.target.matches("[data-option-active]")) {
    const [key, index] = event.target.dataset.optionActive.split(":");
    state.catalog[key][Number(index)].active = event.target.checked;
  }
});

app.addEventListener("input", (event) => {
  if (event.target.matches("#itemNote")) {
    state.custom.note = event.target.value;
  }

  if (event.target.matches("[data-menu-field]")) {
    const [index, field] = event.target.dataset.menuField.split(":");
    const item = state.catalog.menu[Number(index)];
    item[field] = field === "price" ? Number(event.target.value || 0) : event.target.value;
    if (field === "group") {
      item.group = normalizeGroup(item.group);
      if (!item.sizes?.length) {
        item.sizes = defaultSizesForGroup(item.group);
      }
    }
    if (field === "name" && item.name) {
      item.id = item.id || makeId(item.name);
    }
  }

  if (event.target.matches("[data-size-field]")) {
    const [itemIndex, sizeIndex, field] = event.target.dataset.sizeField.split(":");
    const item = state.catalog.menu[Number(itemIndex)];
    const size = item?.sizes?.[Number(sizeIndex)];
    if (size) {
      size[field] = field === "price" ? Number(event.target.value || 0) : event.target.value;
      if (field === "name" && size.name) {
        size.id = size.id || makeId(size.name);
      }
    }
  }

  if (event.target.matches("[data-option-field]")) {
    const [key, index, field] = event.target.dataset.optionField.split(":");
    const item = state.catalog[key][Number(index)];
    item[field] = field === "price" ? Number(event.target.value || 0) : event.target.value;
    if (field === "name" && item.name) {
      item.id = item.id || makeId(item.name);
    }
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.matches("#customizerForm")) {
    event.preventDefault();
    state.custom.milkId = document.querySelector("#milk")?.value || state.custom.milkId;
    state.custom.note = document.querySelector("#itemNote")?.value || "";
    addCustomItem();
  }

  if (event.target.matches("#portalLoginForm")) {
    event.preventDefault();
    const password = document.querySelector("#portalPassword")?.value || "";
    portalLogin(password);
  }
});

render();
startPolling();
