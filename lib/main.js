const { CompositeDisposable, Disposable } = require("lumine");

// Editor-mode band, see the priority convention in the status-bar package
// README. The four icons share the package's slot at 240 and step by one so
// they keep a fixed order no matter which of them the user enables first.
const TILE_CONFIG = {
  workspace: { icon: "icon-browser", priority: 240 },
  editor: { icon: "icon-code", priority: 241 },
  image: { icon: "icon-file-media", priority: 242 },
  pdfviewer: { icon: "icon-file-pdf", priority: 243 },
};

module.exports = {
  subscriptions: null,
  statusBar: null,
  tiles: {},
  icons: {},
  pdfViewers: null,

  activate() {
    this.subscriptions = new CompositeDisposable();
    this.tiles = {};
    this.icons = {};
    this.tooltips = {};
    this.pdfViewers = new Map();
    document.body.classList.add("invert-colors-transitions");

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "invert-colors:workspace": () => this.workspaceToggle(),
        "invert-colors:editor": () => this.editorToggle(),
        "invert-colors:image": () => this.imageToggle(),
        "invert-colors:pdfviewer": () => this.pdfviewerToggle(),
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
      lumine.config.observe("invert-colors.pdfviewerState", (state) => {
        this.pdfviewerUpdate(state);
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
      lumine.config.onDidChange("invert-colors.pdfviewerStatusIcon", ({ newValue }) => {
        newValue ? this.activateTile("pdfviewer") : this.deactivateTile("pdfviewer");
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    for (const viewer of this.pdfViewers.values()) {
      this.applyPdfViewerState(viewer, false);
    }
    document.body.classList.remove(
      "invert-colors-transitions",
      "invert-colors-workspace",
      "invert-colors-editor",
      "invert-colors-image",
    );
    for (const key of Object.keys(TILE_CONFIG)) {
      this.deactivateTile(key);
    }
  },

  workspaceToggle() {
    const current = lumine.config.get("invert-colors.workspaceState");
    lumine.config.set("invert-colors.workspaceState", !current);
  },

  workspaceUpdate(state) {
    document.body.classList.toggle("invert-colors-workspace", state);
    if (this.icons.workspace) {
      this.icons.workspace.classList.toggle("active", state);
    }
  },

  editorToggle() {
    const current = lumine.config.get("invert-colors.editorState");
    lumine.config.set("invert-colors.editorState", !current);
  },

  editorUpdate(state) {
    document.body.classList.toggle("invert-colors-editor", state);
    if (this.icons.editor) {
      this.icons.editor.classList.toggle("active", state);
    }
  },

  imageToggle() {
    const current = lumine.config.get("invert-colors.imageState");
    lumine.config.set("invert-colors.imageState", !current);
  },

  imageUpdate(state) {
    document.body.classList.toggle("invert-colors-image", state);
    if (this.icons.image) {
      this.icons.image.classList.toggle("active", state);
    }
  },

  pdfviewerToggle() {
    const current = lumine.config.get("invert-colors.pdfviewerState");
    lumine.config.set("invert-colors.pdfviewerState", !current);
  },

  pdfviewerUpdate(state) {
    for (const viewer of this.pdfViewers.values()) {
      this.applyPdfViewerState(viewer, state);
    }
    if (this.icons.pdfviewer) {
      this.icons.pdfviewer.classList.toggle("active", state);
    }
  },

  consumePdfView(service) {
    const subscription = service.observeViewers((viewer) => {
      this.observePdfViewer(viewer);
    });

    return new Disposable(() => {
      subscription.dispose();
      for (const viewer of this.pdfViewers.values()) {
        this.applyPdfViewerState(viewer, false);
        this.unobservePdfViewer(viewer);
      }
      this.pdfViewers.clear();
    });
  },

  observePdfViewer(viewer) {
    if (this.pdfViewers.has(viewer)) {
      return;
    }

    const applyState = () => {
      const entry = this.pdfViewers.get(viewer);
      if (entry) {
        this.applyPdfViewerState(entry);
      }
    };
    viewer.onDidDispose?.(() => {
      const entry = this.pdfViewers.get(viewer);
      if (entry) {
        this.unobservePdfViewer(entry);
      }
      this.pdfViewers.delete(viewer);
    });

    viewer.element?.addEventListener("load", applyState);
    this.pdfViewers.set(viewer, { viewer, applyState });
    const ready = viewer.whenReady?.();
    ready?.then(applyState);
  },

  unobservePdfViewer(entry) {
    entry.viewer.element?.removeEventListener("load", entry.applyState);
  },

  applyPdfViewerState(entry, state = lumine.config.get("invert-colors.pdfviewerState")) {
    entry.viewer.setColorInverted(state);
  },

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar;
    for (const key of Object.keys(TILE_CONFIG)) {
      if (lumine.config.get(`invert-colors.${key}StatusIcon`)) {
        this.activateTile(key);
      }
    }
  },

  activateTile(key) {
    if (!this.statusBar || this.tiles[key]) {
      return;
    }
    const element = document.createElement("div");
    element.classList.add("invert-colors-status", "inline-block");
    const icon = document.createElement("span");
    icon.classList.add("icon", TILE_CONFIG[key].icon);
    if (lumine.config.get(`invert-colors.${key}State`)) {
      icon.classList.add("active");
    }
    element.appendChild(icon);
    element.addEventListener("click", () => {
      const current = lumine.config.get(`invert-colors.${key}State`);
      lumine.config.set(`invert-colors.${key}State`, !current);
    });
    this.icons[key] = icon;
    this.tiles[key] = this.statusBar.addRightTile({
      item: element,
      priority: TILE_CONFIG[key].priority,
    });
    this.tooltips[key] = lumine.tooltips.add(element, {
      title: () =>
        `Invert ${key} colors is ${lumine.config.get(`invert-colors.${key}State`) ? "enabled" : "disabled"}`,
      keyBindingCommand: `invert-colors:${key}`,
      keyBindingTarget: lumine.views.getView(lumine.workspace),
    });
  },

  deactivateTile(key) {
    if (this.tiles[key]) {
      this.tooltips[key]?.dispose();
      delete this.tooltips[key];
      this.tiles[key].destroy();
      delete this.tiles[key];
      delete this.icons[key];
    }
  },
};
