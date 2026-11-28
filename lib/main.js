const { CompositeDisposable, Disposable } = require("lumine");

// Four independent indicator arcs, clockwise from the top right. These
// describe configuration switches, including combinations that invert twice.
const MODES = {
  workspace: {
    label: "Workspace",
    command: "workspace",
    path: "M9.6 2.01A6.2 6.2 0 0 1 13.99 6.4",
  },
  editor: { label: "All Editors", command: "editor", path: "M13.99 9.6A6.2 6.2 0 0 1 9.6 13.99" },
  image: { label: "All Images", command: "image", path: "M6.4 13.99A6.2 6.2 0 0 1 2.01 9.6" },
  pdfView: { label: "All PDFs", command: "pdf-view", path: "M2.01 6.4A6.2 6.2 0 0 1 6.4 2.01" },
};
const STATUS_ICON =
  '<svg class="icon-glyph" viewBox="0 0 16 16" focusable="false">' +
  '<path class="invert-colors-contrast-half" d="M8 5A3 3 0 0 0 8 11Z"></path>' +
  '<circle class="invert-colors-contrast-outline" cx="8" cy="8" r="3"></circle>' +
  Object.entries(MODES)
    .map(
      ([key, mode]) =>
        `<path class="invert-colors-segment" data-mode="${key}" d="${mode.path}"></path>`,
    )
    .join("") +
  "</svg>";

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "invert-colors",
      tips: [
        "{% if keys['invert-colors:image'] %}You can invert the colors of the image you are viewing with {{ 'invert-colors:image' | keystroke }}{% else %}You can invert the colors of an image or a PDF to read it against a dark theme.{% endif %}",
      ],
    };
  },

  subscriptions: null,
  inversionTargets: null,

  activate() {
    this.subscriptions = new CompositeDisposable();
    this.statusBars = new Map();
    this.inversionTargets = new Map();
    const owner = this.subscriptions;
    const owns = () => this.subscriptions === owner;
    for (const body of this.presentationBodies()) body.classList.add("invert-colors-transitions");
    owner.add(
      lumine.workspace.observeWindows((window) => {
        const body = window.getDocument()?.body;
        if (!body) return;
        body.classList.add("invert-colors-transitions");
        for (const key of ["workspace", "editor", "image"])
          body.classList.toggle(
            `invert-colors-${key}`,
            lumine.config.get(`invert-colors.${key}State`),
          );
      }),
    );

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "invert-colors:workspace": {
          description: "Invert the colours of the workspace in every window.",
          checked: () => Boolean(lumine.config.get("invert-colors.workspaceState")),
          didDispatch: () => owns() && this.workspaceToggle(),
        },
        "invert-colors:editor": {
          description: "Invert the colours of all text editors.",
          checked: () => Boolean(lumine.config.get("invert-colors.editorState")),
          didDispatch: () => owns() && this.editorToggle(),
        },
        "invert-colors:image": {
          description: "Invert the colours of all images.",
          checked: () => Boolean(lumine.config.get("invert-colors.imageState")),
          didDispatch: () => owns() && this.imageToggle(),
        },
        "invert-colors:pdf-view": {
          description: "Invert the colours of all PDF views.",
          checked: () => Boolean(lumine.config.get("invert-colors.pdfViewState")),
          didDispatch: () => owns() && this.pdfViewToggle(),
        },
        "invert-colors:disable-all": {
          description: "Restore normal colours by disabling every inversion mode.",
          didDispatch: () => owns() && this.disableAll(),
        },
      }),
    );

    this.subscriptions.add(
      lumine.config.observe("invert-colors.workspaceState", (state) => {
        if (!owns()) return;
        this.workspaceUpdate(state);
      }),
      lumine.config.observe("invert-colors.editorState", (state) => {
        if (!owns()) return;
        this.editorUpdate(state);
      }),
      lumine.config.observe("invert-colors.imageState", (state) => {
        if (!owns()) return;
        this.imageUpdate(state);
      }),
      lumine.config.observe("invert-colors.pdfViewState", (state) => {
        if (!owns()) return;
        this.pdfViewUpdate(state);
      }),
      lumine.config.onDidChange("invert-colors.statusIcon", ({ newValue }) => {
        if (!owns()) return;
        newValue ? this.activateTile() : this.deactivateTile();
      }),
    );
  },

  presentationBodies() {
    const bodies = lumine.workspace
      .getWindows()
      .map((window) => window.getDocument()?.body)
      .filter(Boolean);
    return bodies.length ? bodies : [document.body];
  },

  deactivate() {
    const owner = this.subscriptions;
    const records = this.statusBars;
    const viewers = this.inversionTargets;
    const retired = [...(records?.values() ?? [])];
    this.subscriptions = null;
    this.statusBars = null;
    this.inversionTargets = null;
    records?.clear();
    for (const body of this.presentationBodies())
      body.classList.remove(
        "invert-colors-transitions",
        "invert-colors-workspace",
        "invert-colors-editor",
        "invert-colors-image",
      );
    owner?.dispose();
    for (const record of retired) this.deactivateTileRecord(record);
    viewers?.clear();
  },

  disableAll() {
    for (const key of Object.keys(MODES)) lumine.config.set(`invert-colors.${key}State`, false);
  },

  workspaceToggle() {
    const current = lumine.config.get("invert-colors.workspaceState");
    lumine.config.set("invert-colors.workspaceState", !current);
  },

  workspaceUpdate(state) {
    for (const body of this.presentationBodies())
      body.classList.toggle("invert-colors-workspace", state);
    this.updateIcons("workspace", state);
  },

  editorToggle() {
    const current = lumine.config.get("invert-colors.editorState");
    lumine.config.set("invert-colors.editorState", !current);
  },

  editorUpdate(state) {
    for (const body of this.presentationBodies())
      body.classList.toggle("invert-colors-editor", state);
    this.updateIcons("editor", state);
  },

  imageToggle() {
    const current = lumine.config.get("invert-colors.imageState");
    lumine.config.set("invert-colors.imageState", !current);
  },

  imageUpdate(state) {
    for (const body of this.presentationBodies())
      body.classList.toggle("invert-colors-image", state);
    this.updateIcons("image", state);
  },

  pdfViewToggle() {
    const current = lumine.config.get("invert-colors.pdfViewState");
    lumine.config.set("invert-colors.pdfViewState", !current);
  },

  pdfViewUpdate(state) {
    for (const viewer of this.inversionTargets?.values() ?? []) {
      this.applyInversionTargetState(viewer, state);
    }
    this.updateIcons("pdfView", state);
  },

  updateIcons(key, state) {
    for (const record of this.statusBars?.values() ?? []) {
      record.segments[key]?.classList.toggle("active", state);
      record.element?.setAttribute("aria-label", this.statusTitle());
    }
  },

  statusTitle() {
    const active = Object.entries(MODES)
      .filter(([key]) => lumine.config.get(`invert-colors.${key}State`))
      .map(([, { label }]) => label);
    return `Invert colors: ${active.length ? active.join(", ") : "all modes off"}. Disable all inversion.`;
  },

  consumeInversionProvider(service) {
    if (
      !service ||
      typeof service.targetType !== "string" ||
      !service.targetType ||
      typeof service.observeTargets !== "function"
    )
      throw new TypeError("An inversion provider requires targetType and observeTargets.");
    // Consumers may implement more categories in future service versions.
    // An unknown category contributes no targets or registrations today.
    if (service.targetType !== "pdf") return new Disposable();
    const owner = this.subscriptions;
    const targets = this.inversionTargets;
    if (!owner || !targets) return new Disposable();
    const edge = new CompositeDisposable();
    const connection = { targets: new Set(), entries: targets, targetType: service.targetType };
    edge.add(
      new Disposable(() => {
        owner.remove(edge);
        for (const target of [...connection.targets])
          this.releaseInversionTarget(target, connection);
      }),
    );
    owner.add(edge);
    try {
      const subscription = service.observeTargets((target) => {
        if (edge.disposed || this.subscriptions !== owner) return;
        // A late, invalid publication must never throw out of a provider's
        // opener. Synchronous provider shape errors are rejected above.
        try {
          this.observeInversionTarget(target, connection);
        } catch (error) {
          try {
            this.releaseInversionTarget(target, connection);
          } catch {
            // A broken target can also throw while resetting its presentation.
          }
          if (!connection.warned) {
            connection.warned = true;
            console.warn("Ignoring an invalid inversion provider target:", error);
          }
        }
      });
      if (typeof subscription?.dispose !== "function")
        throw new TypeError("An inversion provider observer must return a Disposable.");
      if (edge.disposed || this.subscriptions !== owner) subscription.dispose();
      else edge.add(subscription);
    } catch (error) {
      edge.dispose();
      throw error;
    }
    return edge;
  },

  observeInversionTarget(target, connection) {
    if (
      !target ||
      typeof target !== "object" ||
      typeof target.setInverted !== "function" ||
      typeof target.onDidDestroy !== "function"
    )
      throw new TypeError("An inversion target requires setInverted and onDidDestroy.");
    if (connection.targets.has(target)) return;
    const entries = connection.entries;
    let entry = entries.get(target);
    connection.targets.add(target);
    if (entry) {
      entry.connections.add(connection);
      return;
    }
    entry = {
      target,
      targetType: connection.targetType,
      connections: new Set([connection]),
      subscriptions: new CompositeDisposable(),
    };
    entries.set(target, entry);
    const subscription = target.onDidDestroy(() => {
      if (entries.get(target) !== entry) return;
      entries.delete(target);
      for (const edge of entry.connections) edge.targets.delete(target);
      entry.connections.clear();
      entry.subscriptions.dispose();
    });
    if (typeof subscription?.dispose !== "function")
      throw new TypeError("An inversion target lifetime observer must return a Disposable.");
    if (entries.get(target) !== entry || entry.connections.size === 0) subscription.dispose();
    else entry.subscriptions.add(subscription);
    // The handle preserves its state across document reloads itself.
    if (entries.get(target) === entry) this.applyInversionTargetState(entry);
  },

  releaseInversionTarget(target, connection) {
    connection.targets.delete(target);
    const entries = connection.entries;
    const entry = entries.get(target);
    if (!entry) return;
    entry.connections.delete(connection);
    if (entry.connections.size) return;
    entries.delete(target);
    entry.subscriptions.dispose();
    // Disposing a listener can publish a replacement edge reentrantly.
    if (!entries.has(target) && !this.inversionTargets?.has(target))
      this.applyInversionTargetState(entry, false);
  },

  applyInversionTargetState(entry, state = lumine.config.get("invert-colors.pdfViewState")) {
    entry.target.setInverted(Boolean(state));
  },

  consumeStatusBar(service) {
    return service.observeWindows(
      (scopedStatusBar, context) => this.consumeWindowStatusBar(scopedStatusBar, context),
      { windows: "main" },
    );
  },

  consumeWindowStatusBar(statusBar, context) {
    const owner = this.subscriptions;
    const records = this.statusBars;
    if (!owner || !records) return new Disposable();
    let record = records.get(statusBar);
    if (!record) {
      record = {
        statusBar,
        context,
        references: 0,
        segments: {},
        tile: null,
        element: null,
        tooltip: null,
        menu: null,
      };
      records.set(statusBar, record);
    }
    record.references++;
    const registration = new Disposable(() => {
      owner.remove(registration);
      if (--record.references !== 0) return;
      if (records.get(statusBar) === record) records.delete(statusBar);
      this.deactivateTileRecord(record);
    });
    owner.add(registration);
    if (lumine.config.get("invert-colors.statusIcon")) this.activateTileRecord(record);
    return registration;
  },

  activateTile() {
    for (const record of this.statusBars?.values() ?? []) this.activateTileRecord(record);
  },

  activateTileRecord(record) {
    if (!this.subscriptions || record.references === 0 || record.element) return;
    const owner = this.subscriptions;
    const document = record.context.document;
    const element = document.createElement("status-bar-tile");
    element.classList.add("invert-colors-status");
    element.setAttribute("data-context-menu-boundary", "");
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-haspopup", "menu");
    element.setAttribute("aria-label", this.statusTitle());
    const icon = document.createElement("span");
    icon.classList.add("icon", "icon-svg", "is-icon-only");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = STATUS_ICON;
    record.segments = {};
    for (const segment of icon.querySelectorAll(".invert-colors-segment")) {
      const key = segment.dataset.mode;
      segment.classList.toggle("active", Boolean(lumine.config.get(`invert-colors.${key}State`)));
      record.segments[key] = segment;
    }
    element.appendChild(icon);
    const disableAll = () => {
      if (this.subscriptions !== owner || record.element !== element) return;
      lumine.commands.dispatch(record.context.window.getElement(), "invert-colors:disable-all");
    };
    element.onclick = (event) => {
      if (event.button !== 0 || (process.platform === "darwin" && event.ctrlKey)) return;
      disableAll();
    };
    element.onkeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      disableAll();
    };
    record.element = element;
    const tile = record.statusBar.addRightTile({
      item: element,
      // Editor-mode band; retain the package's original slot.
      priority: 240,
    });
    if (this.subscriptions !== owner || record.element !== element) {
      tile.destroy();
      return;
    }
    record.tile = tile;
    const tooltip = lumine.tooltips.add(element, {
      title: () => this.statusTitle(),
      html: false,
      keyBindingCommand: "invert-colors:disable-all",
      keyBindingTarget: record.context.window.getElement(),
    });
    if (this.subscriptions !== owner || record.element !== element) tooltip.dispose();
    else record.tooltip = tooltip;
    if (this.subscriptions !== owner || record.element !== element) return;
    const shouldDisplay = ({ target }) => target.closest(".invert-colors-status") === element;
    const menu = lumine.contextMenu.add({
      ".invert-colors-status": {
        commandTarget: "focus",
        items: [
          { type: "separator" },
          ...Object.entries(MODES).map(([category, { label, command }]) => ({
            label: `Invert ${label}`,
            command: `invert-colors:${command}`,
            type: "checkbox",
            shouldDisplay,
            created() {
              this.checked = Boolean(lumine.config.get(`invert-colors.${category}State`));
            },
          })),
          { type: "separator" },
          { label: "Disable All", command: "invert-colors:disable-all", shouldDisplay },
          { type: "separator" },
        ],
      },
    });
    if (this.subscriptions !== owner || record.element !== element) menu.dispose();
    else record.menu = menu;
  },

  deactivateTile() {
    for (const record of this.statusBars?.values() ?? []) this.deactivateTileRecord(record);
  },

  deactivateTileRecord(record) {
    const { tile, tooltip, element, menu } = record;
    record.tile = null;
    record.tooltip = null;
    record.element = null;
    record.menu = null;
    record.segments = {};
    if (element) {
      element.onclick = null;
      element.onkeydown = null;
    }
    tooltip?.dispose();
    menu?.dispose();
    tile?.destroy();
  },
};
