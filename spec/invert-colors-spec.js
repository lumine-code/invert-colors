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
  });

  describe("pdf-view service consumption", () => {
    let viewer, disposable;

    beforeEach(() => {
      viewer = { setColorInverted: jasmine.createSpy("setColorInverted") };
      disposable = mainModule.consumePdfView({
        observeViewers: (callback) => {
          callback(viewer);
          return new Disposable(() => {});
        },
      });
    });

    it("applies the inversion state to observed viewers", () => {
      lumine.config.set("invert-colors.pdfViewState", true);
      expect(viewer.setColorInverted).toHaveBeenCalledWith(true);

      lumine.config.set("invert-colors.pdfViewState", false);
      expect(viewer.setColorInverted).toHaveBeenCalledWith(false);
    });

    it("applies inversion when toggled by command", () => {
      dispatch("invert-colors:pdf-view");
      expect(viewer.setColorInverted).toHaveBeenCalledWith(true);
    });

    it("restores viewers when the service is disposed", () => {
      lumine.config.set("invert-colors.pdfViewState", true);
      viewer.setColorInverted.calls.reset();
      disposable.dispose();
      expect(viewer.setColorInverted).toHaveBeenCalledWith(false);
    });
  });

  describe("status bar integration", () => {
    beforeEach(async () => {
      await lumine.packages.activatePackage("status-bar");
    });

    it("shows a tile when the status icon setting is enabled", () => {
      expect(workspaceElement.querySelector(".invert-colors-status")).toBeNull();
      lumine.config.set("invert-colors.imageStatusIcon", true);
      expect(workspaceElement.querySelector(".invert-colors-status")).not.toBeNull();

      lumine.config.set("invert-colors.imageStatusIcon", false);
      expect(workspaceElement.querySelector(".invert-colors-status")).toBeNull();
    });

    it("toggles the state when the tile is clicked", () => {
      lumine.config.set("invert-colors.imageStatusIcon", true);
      const tile = workspaceElement.querySelector(".invert-colors-status");
      tile.click();
      expect(lumine.config.get("invert-colors.imageState")).toBe(true);
      expect(tile.querySelector(".icon").classList.contains("active")).toBe(true);

      tile.click();
      expect(lumine.config.get("invert-colors.imageState")).toBe(false);
      expect(tile.querySelector(".icon").classList.contains("active")).toBe(false);
    });
  });
});
