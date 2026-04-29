(() => {
  if (typeof state === "undefined" || typeof render !== "function") return;

  state.catalogDirty = Boolean(state.catalogDirty);
  let suppressCatalogRefreshRender = false;

  const baseNormalizeCatalog = normalizeCatalog;
  normalizeCatalog = function guardedNormalizeCatalog(catalog) {
    if (state.view === "portal" && state.adminAuthed && state.catalogDirty) {
      return state.catalog;
    }
    return baseNormalizeCatalog(catalog);
  };

  const baseApi = api;
  api = async function guardedApi(path, options = {}) {
    if (path === "/api/catalog" && state.view === "portal" && state.adminAuthed && state.catalogDirty) {
      suppressCatalogRefreshRender = true;
      return state.catalog;
    }
    return baseApi(path, options);
  };

  const baseRender = render;
  render = function guardedRender() {
    if (suppressCatalogRefreshRender) {
      suppressCatalogRefreshRender = false;
      return;
    }
    return baseRender();
  };

  const baseRenderPortalView = renderPortalView;
  renderPortalView = function guardedRenderPortalView() {
    const html = baseRenderPortalView();
    if (!state.catalogDirty) return html;
    return html.replace(
      "Saved changes update the iPad order screen.",
      "Unsaved changes. Save before leaving this page."
    );
  };

  const basePortalLogin = portalLogin;
  portalLogin = async function guardedPortalLogin(password) {
    await basePortalLogin(password);
    if (state.adminAuthed) {
      state.catalogDirty = false;
      render();
    }
  };

  saveCatalog = async function guardedSaveCatalog() {
    state.saving = true;
    render();

    try {
      const payload = await api("/api/admin/catalog", {
        method: "POST",
        headers: { "X-Capital-Admin-Password": state.adminPassword },
        body: JSON.stringify(publicCatalogPayload()),
      });
      state.catalogDirty = false;
      state.catalog = baseNormalizeCatalog(payload.catalog || state.catalog);
      setToast("Catalog saved.");
    } catch (error) {
      setToast(error.message);
    } finally {
      state.saving = false;
      render();
    }
  };

  function markDirty() {
    if (state.view === "portal" && state.adminAuthed) {
      state.catalogDirty = true;
    }
  }

  const dirtySelectors = [
    "#showPriceToggle",
    "[data-menu-active]",
    "[data-menu-field]",
    "[data-size-active]",
    "[data-size-field]",
    "[data-option-active]",
    "[data-option-field]",
    "#addMenuItem",
    "[data-add-option]",
    "[data-remove-menu]",
    "[data-add-size]",
    "[data-remove-size]",
    "[data-remove-option]",
  ].join(",");

  function markDirtyFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(dirtySelectors)) {
      markDirty();
    }
  }

  document.addEventListener("input", markDirtyFromEvent, true);
  document.addEventListener("change", markDirtyFromEvent, true);
  document.addEventListener("click", markDirtyFromEvent, true);
})();
