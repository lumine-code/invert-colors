const { CompositeDisposable, Disposable } = require("lumine");

// Editor-mode band, see the priority convention in the status-bar package
// README. The four icons share the package's slot at 240 and step by one so
// they keep a fixed order no matter which of them the user enables first.
const TILE_CONFIG = {
  workspace: { icon: "icon-browser", priority: 240 },
  editor: { icon: "icon-code", priority: 241 },
  image: { icon: "icon-file-media", priority: 242 },
  pdfView: { icon: "icon-file-pdf", priority: 243 },
};

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
  pdfViewers: null,

  activate() {
    this.subscriptions = new CompositeDisposable();
    this.statusBars = new Map();
    this.pdfViewers = new Map();
    document.body.classList.add("invert-colors-transitions");

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "invert-colors:workspace": {
          description: "Invert the colours of the whole window.",
          didDispatch: () => this.workspaceToggle(),
        },
        "invert-colors:editor": {
          description: "Invert the colours of the active editor alone.",
          didDispatch: () => this.editorToggle(),
        },
        "invert-colors:image": {
          description: "Invert the colours of the image being viewed.",
          didDispatch: () => this.imageToggle(),
        },
        "invert-colors:pdf-view": {
          description: "Invert the colours of the PDF being viewed.",
          didDispatch: () => this.pdfViewToggle(),
        },
      }),
    );

    this.subscriptions.add(
      lumine.config.observe("invert-colors.workspaceState", (state) => {
        this.workspaceUpdate(state);
      }),
      lumine.config.observe("invert-colors.editorState", (state) => {
        this.editorUpdate(state);
      }),
      lumine.config.observe("invert-colors.imageState", (state) => {
        this.imageUpdate(state);
      }),
      lumine.config.observe("invert-colors.pdfViewState", (state) => {
        this.pdfViewUpdate(state);
      }),
      lumine.config.onDidChange("invert-colors.workspaceStatusIcon", ({ newValue }) => {
        newValue ? this.activateTile("workspace") : this.deactivateTile("workspace");
      }),
      lumine.config.onDidChange("invert-colors.editorStatusIcon", ({ newValue }) => {
        newValue ? this.activateTile("editor") : this.deactivateTile("editor");
      }),
      lumine.config.onDidChange("invert-colors.imageStatusIcon", ({ newValue }) => {
        newValue ? this.activateTile("image") : this.deactivateTile("image");
      }),
      lumine.config.onDidChange("invert-colors.pdfViewStatusIcon", ({ newValue }) => {
        newValue ? this.activateTile("pdfView") : this.deactivateTile("pdfView");
      }),
    );
  },

  deactivate() {
    const owner = this.subscriptions;
    this.subscriptions = null;
    owner?.dispose();
    document.body.classList.remove(
      "invert-colors-transitions",
      "invert-colors-workspace",
      "invert-colors-editor",
      "invert-colors-image",
    );
    for (const key of Object.keys(TILE_CONFIG)) {
      this.deactivateTile(key);
    }
    this.statusBars = null;
  },

  workspaceToggle() {
    const current = lumine.config.get("invert-colors.workspaceState");
    lumine.config.set("invert-colors.workspaceState", !current);
  },

  workspaceUpdate(state) {
    document.body.classList.toggle("invert-colors-workspace", state);
    this.updateIcons("workspace", state);
  },

  editorToggle() {
    const current = lumine.config.get("invert-colors.editorState");
    lumine.config.set("invert-colors.editorState", !current);
  },

  editorUpdate(state) {
    document.body.classList.toggle("invert-colors-editor", state);
    this.updateIcons("editor", state);
  },

  imageToggle() {
    const current = lumine.config.get("invert-colors.imageState");
    lumine.config.set("invert-colors.imageState", !current);
  },

  imageUpdate(state) {
    document.body.classList.toggle("invert-colors-image", state);
    this.updateIcons("image", state);
  },

  pdfViewToggle() {
    const current = lumine.config.get("invert-colors.pdfViewState");
    lumine.config.set("invert-colors.pdfViewState", !current);
  },

  pdfViewUpdate(state) {
    for (const viewer of this.pdfViewers.values()) {
      this.applyPdfViewerState(viewer, state);
    }
    this.updateIcons("pdfView", state);
  },

  updateIcons(key, state) {
    for (const record of this.statusBars?.values() ?? []) {
      record.icons[key]?.classList.toggle("active", state);
    }
  },

  consumePdfView(service) {
    const owner = this.subscriptions;
    const viewers = this.pdfViewers;
    if (!owner || !viewers) return new Disposable();
    const edge = new CompositeDisposable();
    const connection = { viewers: new Set(), entries: viewers };
    edge.add(
      new Disposable(() => {
        owner.remove(edge);
        for (const viewer of [...connection.viewers]) this.releasePdfViewer(viewer, connection);
      }),
    );
    owner.add(edge);
    try {
      edge.add(
        service.observeViewers((viewer) => {
          if (!edge.disposed && this.subscriptions === owner)
            this.observePdfViewer(viewer, connection);
        }),
      );
    } catch (error) {
      edge.dispose();
      throw error;
    }
    return edge;
  },

  observePdfViewer(viewer, connection) {
    if (connection.viewers.has(viewer)) return;
    const entries = connection.entries;
    let entry = entries.get(viewer);
    connection.viewers.add(viewer);
    if (entry) {
      entry.connections.add(connection);
      return;
    }
    entry = {
      viewer,
      connections: new Set([connection]),
      subscriptions: new CompositeDisposable(),
    };
    entries.set(viewer, entry);
    const subscription = viewer.onDidDispose?.(() => {
      if (entries.get(viewer) !== entry) return;
      entries.delete(viewer);
      for (const edge of entry.connections) edge.viewers.delete(viewer);
      entry.connections.clear();
      entry.subscriptions.dispose();
    });
    if (subscription) entry.subscriptions.add(subscription);
    // One apply is enough: the viewer keeps the inverted state sticky and
    // re-asserts it itself on every reload of its document.
    if (entries.get(viewer) === entry) this.applyPdfViewerState(entry);
  },

  releasePdfViewer(viewer, connection) {
    connection.viewers.delete(viewer);
    const entries = connection.entries;
    const entry = entries.get(viewer);
    if (!entry) return;
    entry.connections.delete(connection);
    if (entry.connections.size) return;
    entries.delete(viewer);
    entry.subscriptions.dispose();
    // Disposing a listener can publish a replacement edge reentrantly.
    if (!entries.has(viewer)) this.applyPdfViewerState(entry, false);
  },

  applyPdfViewerState(entry, state = lumine.config.get("invert-colors.pdfViewState")) {
    entry.viewer.setColorInverted(state);
  },

  consumeStatusBar(statusBar) {
    const owner = this.subscriptions;
    const records = this.statusBars;
    if (!owner || !records) return new Disposable();
    let record = records.get(statusBar);
    if (!record) {
      record = { statusBar, references: 0, tiles: {}, icons: {}, elements: {}, tooltips: {} };
      records.set(statusBar, record);
    }
    record.references++;
    const registration = new Disposable(() => {
      owner.remove(registration);
      if (--record.references !== 0) return;
      if (records.get(statusBar) === record) records.delete(statusBar);
      for (const key of Object.keys(TILE_CONFIG)) this.deactivateTileRecord(key, record);
    });
    owner.add(registration);
    for (const key of Object.keys(TILE_CONFIG)) {
      if (lumine.config.get(`invert-colors.${key}StatusIcon`)) this.activateTileRecord(key, record);
    }
    return registration;
  },

  activateTile(key) {
    for (const record of this.statusBars?.values() ?? []) this.activateTileRecord(key, record);
  },

  activateTileRecord(key, record) {
    if (!this.subscriptions || record.references === 0 || record.tiles[key]) return;
    const owner = this.subscriptions;
    const element = document.createElement("status-bar-tile");
    element.classList.add("invert-colors-status");
    const icon = document.createElement("span");
    icon.classList.add("icon", "is-icon-only", TILE_CONFIG[key].icon);
    if (lumine.config.get(`invert-colors.${key}State`)) {
      icon.classList.add("active");
    }
    element.appendChild(icon);
    element.onclick = () => {
      const current = lumine.config.get(`invert-colors.${key}State`);
      lumine.config.set(`invert-colors.${key}State`, !current);
    };
    record.icons[key] = icon;
    record.elements[key] = element;
    const tile = record.statusBar.addRightTile({
      item: element,
      priority: TILE_CONFIG[key].priority,
    });
    if (this.subscriptions !== owner || record.icons[key] !== icon) {
      tile.destroy();
      return;
    }
    record.tiles[key] = tile;
    const tooltip = lumine.tooltips.add(element, {
      title: () =>
        `Invert ${key} colors is ${lumine.config.get(`invert-colors.${key}State`) ? "enabled" : "disabled"}`,
      keyBindingCommand: `invert-colors:${key}`,
      keyBindingTarget: lumine.views.getView(lumine.workspace),
    });
    if (this.subscriptions !== owner || record.icons[key] !== icon) tooltip.dispose();
    else record.tooltips[key] = tooltip;
  },

  deactivateTile(key) {
    for (const record of this.statusBars?.values() ?? []) this.deactivateTileRecord(key, record);
  },

  deactivateTileRecord(key, record) {
    const tile = record.tiles[key];
    const tooltip = record.tooltips[key];
    const element = record.elements[key];
    delete record.tiles[key];
    delete record.tooltips[key];
    delete record.icons[key];
    delete record.elements[key];
    if (element) element.onclick = null;
    tooltip?.dispose();
    tile?.destroy();
  },
};
