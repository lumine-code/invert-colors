const windowService = require("./helpers/window-service");
const { Disposable } = require("lumine");

describe("invert-colors", () => {
  let workspaceElement, mainModule;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    mainModule = (await lumine.packages.activatePackage("invert-colors")).mainModule;
  });

  function dispatch(command) {
    lumine.commands.dispatch(workspaceElement, command);
  }

  function trackedTarget() {
    const listeners = new Set();
    return {
      listeners,
      setInverted: jasmine.createSpy("setInverted"),
      onDidDestroy(callback) {
        listeners.add(callback);
        return new Disposable(() => listeners.delete(callback));
      },
      dispose() {
        for (const callback of [...listeners]) callback();
      },
    };
  }

  function targetService(...viewers) {
    return {
      targetType: "pdf",
      observeTargets(callback) {
        for (const viewer of viewers) callback(viewer);
        return new Disposable();
      },
    };
  }

  it("marks the body for animated transitions", () => {
    expect(document.body.classList.contains("invert-colors-transitions")).toBe(true);
  });

  describe("toggle commands", () => {
    it("toggles workspace inversion", () => {
      dispatch("invert-colors:workspace");
      expect(lumine.config.get("invert-colors.workspaceState")).toBe(true);
      expect(document.body.classList.contains("invert-colors-workspace")).toBe(true);

      dispatch("invert-colors:workspace");
      expect(lumine.config.get("invert-colors.workspaceState")).toBe(false);
      expect(document.body.classList.contains("invert-colors-workspace")).toBe(false);
    });

    it("toggles editor inversion", () => {
      dispatch("invert-colors:editor");
      expect(document.body.classList.contains("invert-colors-editor")).toBe(true);

      dispatch("invert-colors:editor");
      expect(document.body.classList.contains("invert-colors-editor")).toBe(false);
    });

    it("toggles image inversion", () => {
      dispatch("invert-colors:image");
      expect(document.body.classList.contains("invert-colors-image")).toBe(true);

      dispatch("invert-colors:image");
      expect(document.body.classList.contains("invert-colors-image")).toBe(false);
    });

    it("applies state changes made directly through the config", () => {
      lumine.config.set("invert-colors.workspaceState", true);
      expect(document.body.classList.contains("invert-colors-workspace")).toBe(true);
    });

    it("disables every inversion mode without enabling modes that are already off", () => {
      const categories = ["workspace", "editor", "image", "pdfView"];
      const viewer = trackedTarget();
      const edge = mainModule.consumeInversionProvider(targetService(viewer));
      try {
        for (const category of categories)
          lumine.config.set(`invert-colors.${category}State`, true);
        viewer.setInverted.calls.reset();
        dispatch("invert-colors:disable-all");
        expect(
          categories.map((category) => lumine.config.get(`invert-colors.${category}State`)),
        ).toEqual(categories.map(() => false));
        for (const category of ["workspace", "editor", "image"])
          expect(document.body.classList.contains(`invert-colors-${category}`)).toBeFalse();
        expect(viewer.setInverted).toHaveBeenCalledOnceWith(false);

        dispatch("invert-colors:disable-all");
        expect(
          categories.map((category) => lumine.config.get(`invert-colors.${category}State`)),
        ).toEqual(categories.map(() => false));
        expect(viewer.setInverted).toHaveBeenCalledOnceWith(false);
      } finally {
        edge.dispose();
      }
    });
  });

  describe("inversion provider consumption", () => {
    let viewer, disposable;

    beforeEach(() => {
      viewer = trackedTarget();
      disposable = mainModule.consumeInversionProvider({
        targetType: "pdf",
        observeTargets: (callback) => {
          callback(viewer);
          return new Disposable(() => {});
        },
      });
    });

    it("applies the inversion state to observed viewers", () => {
      lumine.config.set("invert-colors.pdfViewState", true);
      expect(viewer.setInverted).toHaveBeenCalledWith(true);

      lumine.config.set("invert-colors.pdfViewState", false);
      expect(viewer.setInverted).toHaveBeenCalledWith(false);
    });

    it("applies inversion when toggled by command", () => {
      dispatch("invert-colors:pdf-view");
      expect(viewer.setInverted).toHaveBeenCalledWith(true);
    });

    it("restores viewers when the service is disposed", () => {
      lumine.config.set("invert-colors.pdfViewState", true);
      viewer.setInverted.calls.reset();
      disposable.dispose();
      expect(viewer.setInverted).toHaveBeenCalledWith(false);
    });
  });

  describe("inversion provider ownership", () => {
    it("removes only viewers owned by a disconnected edge", () => {
      const first = trackedTarget();
      const second = trackedTarget();
      const firstEdge = mainModule.consumeInversionProvider(targetService(first));
      const secondEdge = mainModule.consumeInversionProvider(targetService(second));
      try {
        lumine.config.set("invert-colors.pdfViewState", true);
        second.setInverted.calls.reset();
        firstEdge.dispose();

        expect(second.setInverted).not.toHaveBeenCalled();
        expect(mainModule.inversionTargets.has(first)).toBe(false);
        expect(mainModule.inversionTargets.has(second)).toBe(true);
        expect(first.listeners.size).toBe(0);
        lumine.config.set("invert-colors.pdfViewState", false);
        lumine.config.set("invert-colors.pdfViewState", true);
        expect(second.setInverted).toHaveBeenCalledWith(true);
      } finally {
        firstEdge.dispose();
        secondEdge.dispose();
      }
    });

    it("shares a viewer and disposal listener until its final edge disconnects", () => {
      const viewer = trackedTarget();
      const service = targetService(viewer, viewer);
      const firstEdge = mainModule.consumeInversionProvider(service);
      const secondEdge = mainModule.consumeInversionProvider(service);
      try {
        lumine.config.set("invert-colors.pdfViewState", true);
        expect(viewer.listeners.size).toBe(1);
        viewer.setInverted.calls.reset();
        firstEdge.dispose();

        expect(viewer.setInverted).not.toHaveBeenCalled();
        expect(mainModule.inversionTargets.has(viewer)).toBe(true);
        expect(viewer.listeners.size).toBe(1);
        secondEdge.dispose();
        expect(viewer.setInverted).toHaveBeenCalledOnceWith(false);
        expect(mainModule.inversionTargets.has(viewer)).toBe(false);
        expect(viewer.listeners.size).toBe(0);
      } finally {
        firstEdge.dispose();
        secondEdge.dispose();
      }
    });

    it("releases disposal listeners when a viewer closes before its edges", () => {
      const viewer = trackedTarget();
      const firstEdge = mainModule.consumeInversionProvider(targetService(viewer));
      const secondEdge = mainModule.consumeInversionProvider(targetService(viewer));
      viewer.dispose();
      viewer.setInverted.calls.reset();
      firstEdge.dispose();
      secondEdge.dispose();

      expect(mainModule.inversionTargets.has(viewer)).toBe(false);
      expect(viewer.listeners.size).toBe(0);
      expect(viewer.setInverted).not.toHaveBeenCalled();
    });

    it("ignores a late viewer callback after its edge is disposed", () => {
      const viewer = trackedTarget();
      let publish;
      const edge = mainModule.consumeInversionProvider({
        targetType: "pdf",
        observeTargets(callback) {
          publish = callback;
          return new Disposable();
        },
      });
      edge.dispose();
      publish(viewer);

      expect(mainModule.inversionTargets.has(viewer)).toBe(false);
      expect(viewer.listeners.size).toBe(0);
      expect(viewer.setInverted).not.toHaveBeenCalled();
    });

    it("releases manual edges on deactivation without touching a new generation", async () => {
      const viewer = trackedTarget();
      const oldEdge = mainModule.consumeInversionProvider(targetService(viewer));
      await lumine.packages.deactivatePackage("invert-colors");
      expect(viewer.listeners.size).toBe(0);
      mainModule = (await lumine.packages.activatePackage("invert-colors")).mainModule;
      const newEdge = mainModule.consumeInversionProvider(targetService(viewer));
      try {
        viewer.setInverted.calls.reset();
        oldEdge.dispose();

        expect(mainModule.inversionTargets.has(viewer)).toBe(true);
        expect(viewer.listeners.size).toBe(1);
        expect(viewer.setInverted).not.toHaveBeenCalled();
      } finally {
        newEdge.dispose();
      }
    });
  });

  describe("generic inversion provider contract", () => {
    it("requires the provider contract and exposes no viewer-specific consumer", () => {
      expect(() => mainModule.consumeInversionProvider(null)).toThrowError(TypeError);
      expect(() => mainModule.consumeInversionProvider({ observeTargets() {} })).toThrowError(
        TypeError,
      );
      expect(() => mainModule.consumeInversionProvider({ targetType: "pdf" })).toThrowError(
        TypeError,
      );
      expect(mainModule.consumePdfView).toBeUndefined();
    });

    it("ignores unsupported target categories without registering an observer", () => {
      const observeTargets = jasmine.createSpy("observeTargets");
      const edge = mainModule.consumeInversionProvider({
        targetType: "future-category",
        observeTargets,
      });
      expect(observeTargets).not.toHaveBeenCalled();
      expect(mainModule.inversionTargets.size).toBe(0);
      expect(() => edge.dispose()).not.toThrow();
    });

    it("rejects a missing observation disposable and releases its entered targets", () => {
      const target = trackedTarget();
      lumine.config.set("invert-colors.pdfViewState", true);
      expect(() =>
        mainModule.consumeInversionProvider({
          targetType: "pdf",
          observeTargets(callback) {
            callback(target);
          },
        }),
      ).toThrowError(TypeError);
      expect(mainModule.inversionTargets.has(target)).toBe(false);
      expect(target.listeners.size).toBe(0);
      expect(target.setInverted.calls.mostRecent().args).toEqual([false]);
    });

    it("ignores malformed targets emitted by an opener without propagating errors", () => {
      const warning = spyOn(console, "warn");
      let publish;
      const edge = mainModule.consumeInversionProvider({
        targetType: "pdf",
        observeTargets(callback) {
          publish = callback;
          return new Disposable();
        },
      });
      try {
        expect(() => publish({})).not.toThrow();
        expect(() => publish({ setInverted() {} })).not.toThrow();
        expect(() => publish({ setInverted() {}, onDidDestroy() {} })).not.toThrow();
        expect(mainModule.inversionTargets.size).toBe(0);
        expect(warning).toHaveBeenCalledTimes(1);
        const valid = trackedTarget();
        publish(valid);
        expect(mainModule.inversionTargets.has(valid)).toBe(true);
      } finally {
        edge.dispose();
      }
    });

    it("contains a failing target setter during publication", () => {
      spyOn(console, "warn");
      const target = trackedTarget();
      target.setInverted.and.throwError("Renderer failed");
      let edge;
      expect(() => {
        edge = mainModule.consumeInversionProvider(targetService(target));
      }).not.toThrow();
      try {
        expect(mainModule.inversionTargets.has(target)).toBe(false);
        expect(target.listeners.size).toBe(0);
      } finally {
        edge?.dispose();
      }
    });

    it("disposes a lifetime listener returned after the target synchronously destroys itself", () => {
      const lifetime = new Disposable();
      spyOn(lifetime, "dispose").and.callThrough();
      const target = {
        setInverted: jasmine.createSpy("setInverted"),
        onDidDestroy(callback) {
          callback();
          return lifetime;
        },
      };
      const edge = mainModule.consumeInversionProvider(targetService(target));
      try {
        expect(lifetime.dispose).toHaveBeenCalledTimes(1);
        expect(mainModule.inversionTargets.has(target)).toBe(false);
        expect(target.setInverted).not.toHaveBeenCalled();
      } finally {
        edge.dispose();
      }
    });
  });

  describe("status-bar edge ownership", () => {
    let containers, edges;

    beforeEach(() => {
      containers = [];
      edges = [];
      lumine.config.set("invert-colors.statusIcon", true);
    });

    afterEach(() => {
      for (const edge of edges) edge.dispose();
      for (const container of containers) container.remove();
    });

    function statusBar() {
      const container = document.createElement("div");
      workspaceElement.appendChild(container);
      containers.push(container);
      return {
        container,
        addRightTile({ item }) {
          container.appendChild(item);
          return { destroy: () => item.remove() };
        },
      };
    }

    function connect(service) {
      const edge = mainModule.consumeStatusBar(windowService(service));
      edges.push(edge);
      return edge;
    }

    it("owns and updates one tile in each distinct status-bar provider", () => {
      const first = statusBar();
      const second = statusBar();
      const oldEdge = connect(first);
      connect(second);
      expect(second.container.querySelector(".invert-colors-status")).not.toBeNull();
      oldEdge.dispose();

      expect(first.container.querySelector(".invert-colors-status")).toBeNull();
      const tile = second.container.querySelector(".invert-colors-status");
      expect(tile).not.toBeNull();
      lumine.config.set("invert-colors.imageState", true);
      expect(tile.querySelector('[data-mode="image"]').classList.contains("active")).toBe(true);
      lumine.config.set("invert-colors.statusIcon", false);
      expect(second.container.querySelector(".invert-colors-status")).toBeNull();
      lumine.config.set("invert-colors.statusIcon", true);
      expect(second.container.querySelectorAll(".invert-colors-status").length).toBe(1);
    });

    it("shares the same provider's tile until the final edge is removed", () => {
      const service = statusBar();
      const firstEdge = connect(service);
      const secondEdge = connect(service);
      expect(service.container.querySelectorAll(".invert-colors-status").length).toBe(1);
      firstEdge.dispose();
      expect(service.container.querySelectorAll(".invert-colors-status").length).toBe(1);
      secondEdge.dispose();
      expect(service.container.querySelector(".invert-colors-status")).toBeNull();
    });

    it("retires a tile returned after its setting was disabled reentrantly", () => {
      const service = statusBar();
      const add = service.addRightTile;
      let first = true;
      service.addRightTile = (options) => {
        const tile = add(options);
        if (first) {
          first = false;
          lumine.config.set("invert-colors.statusIcon", false);
        }
        return tile;
      };
      connect(service);
      expect(service.container.querySelector(".invert-colors-status")).toBeNull();
      lumine.config.set("invert-colors.statusIcon", true);
      expect(service.container.querySelectorAll(".invert-colors-status").length).toBe(1);
    });
  });

  describe("status bar integration", () => {
    beforeEach(async () => {
      await lumine.packages.activatePackage("status-bar");
    });

    it("shows a tile when the status icon setting is enabled", () => {
      expect(workspaceElement.querySelector(".invert-colors-status")).toBeNull();
      lumine.config.set("invert-colors.statusIcon", true);
      expect(workspaceElement.querySelectorAll(".invert-colors-status").length).toBe(1);

      lumine.config.set("invert-colors.statusIcon", false);
      expect(workspaceElement.querySelector(".invert-colors-status")).toBeNull();
    });

    it("preserves all states while hidden and restores their current indicators when shown", () => {
      const categories = ["workspace", "editor", "image", "pdfView"];
      lumine.config.set("invert-colors.workspaceState", true);
      lumine.config.set("invert-colors.pdfViewState", true);
      lumine.config.set("invert-colors.statusIcon", true);
      const initial = workspaceElement.querySelector(".invert-colors-status");
      expect(
        [...initial.querySelectorAll(".invert-colors-segment.active")].map(
          (item) => item.dataset.mode,
        ),
      ).toEqual(["workspace", "pdfView"]);

      lumine.config.set("invert-colors.statusIcon", false);
      expect(initial.isConnected).toBeFalse();
      expect(lumine.tooltips.findTooltips(initial)).toEqual([]);
      expect(lumine.contextMenu.templateForElement(initial)).toEqual([]);
      expect(
        categories.map((category) => lumine.config.get(`invert-colors.${category}State`)),
      ).toEqual([true, false, false, true]);
      lumine.config.set("invert-colors.workspaceState", false);
      lumine.config.set("invert-colors.imageState", true);
      expect(document.body.classList.contains("invert-colors-image")).toBeTrue();
      lumine.config.set("invert-colors.statusIcon", true);
      const restored = workspaceElement.querySelector(".invert-colors-status");
      expect(restored).not.toBe(initial);
      expect(workspaceElement.querySelectorAll(".invert-colors-status").length).toBe(1);
      expect(
        [...restored.querySelectorAll(".invert-colors-segment.active")].map(
          (item) => item.dataset.mode,
        ),
      ).toEqual(["image", "pdfView"]);
    });

    it("releases the tile's resources on deactivation and recreates them for the current generation", async () => {
      lumine.config.set("invert-colors.statusIcon", true);
      lumine.config.set("invert-colors.editorState", true);
      const retired = workspaceElement.querySelector(".invert-colors-status");
      await lumine.packages.deactivatePackage("invert-colors");
      expect(retired.isConnected).toBeFalse();
      expect(retired.onclick).toBeNull();
      expect(lumine.tooltips.findTooltips(retired)).toEqual([]);
      expect(lumine.contextMenu.templateForElement(retired)).toEqual([]);

      mainModule = (await lumine.packages.activatePackage("invert-colors")).mainModule;
      const current = workspaceElement.querySelector(".invert-colors-status");
      expect(current).not.toBe(retired);
      expect(workspaceElement.querySelectorAll(".invert-colors-status").length).toBe(1);
      expect(current.querySelector('[data-mode="editor"]').classList.contains("active")).toBeTrue();
      retired.click();
      expect(lumine.config.get("invert-colors.editorState")).toBeTrue();
      current.click();
      expect(lumine.config.get("invert-colors.editorState")).toBeFalse();
    });
  });
});
