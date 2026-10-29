const windowService = require("./helpers/window-service");
const { Disposable, Emitter } = require("lumine");
describe("Invert Colors retirement ownership audit", () => {
  let main, bar, leases, emitters, editor;
  beforeEach(async () => {
    jasmine.attachToDOM(lumine.workspace.getElement());
    leases = [];
    emitters = [];
    editor = await lumine.workspace.open();
    bar = (await lumine.packages.activatePackage("status-bar")).mainModule.statusBar;
    main = (await lumine.packages.activatePackage("invert-colors")).mainModule;
  });
  afterEach(async () => {
    for (const lease of leases) lease.dispose();
    await lumine.packages.deactivatePackage("invert-colors");
    for (const emitter of emitters) emitter.dispose();
    editor.destroy();
    for (const key of ["workspaceState", "statusIcon", "pdfViewState"])
      lumine.config.unset("invert-colors." + key);
    document.body.classList.remove("invert-colors-workspace", "invert-colors-transitions");
  });
  function provide(service) {
    const lease = lumine.packages.serviceHub.provide("invert-colors.provider", "1.0.0", service);
    leases.push(lease);
    return lease;
  }
  function emitter() {
    const value = new Emitter();
    emitters.push(value);
    return value;
  }
  it("keeps the replacement native tile and configured body state after old cleanup reactivates", () => {
    lumine.config.set("invert-colors.statusIcon", true);
    lumine.config.set("invert-colors.workspaceState", true);
    let armed = false,
      replacement;
    const newer = { addRightTile: (options) => bar.addRightTile(options) };
    const older = {
      addRightTile: (options) => {
        const tile = bar.addRightTile(options),
          destroy = tile.destroy.bind(tile);
        tile.destroy = () => {
          destroy();
          if (armed) {
            armed = false;
            main.activate();
            leases.push(main.consumeStatusBar(windowService(newer)));
            replacement = main.statusBars.get(newer);
          }
        };
        return tile;
      },
    };
    leases.push(main.consumeStatusBar(windowService(older)));
    armed = true;
    main.deactivate();
    expect(main.statusBars?.get(newer)).toBe(replacement);
    expect(bar.element.contains(replacement.element)).toBe(true);
    expect(document.body.classList.contains("invert-colors-workspace")).toBe(true);
    expect(document.body.classList.contains("invert-colors-transitions")).toBe(true);
  });
  it("does not reapply body inversion from a copied real Config callback after retirement", () => {
    main.deactivate();
    let armed = false;
    leases.push(
      lumine.config.onDidChange("invert-colors.workspaceState", () => {
        if (armed) {
          armed = false;
          main.deactivate();
        }
      }),
    );
    main.activate();
    armed = true;
    lumine.config.set("invert-colors.workspaceState", true);
    expect(lumine.config.get("invert-colors.workspaceState")).toBe(true);
    expect(document.body.classList.contains("invert-colors-workspace")).toBe(false);
  });
  it("releases a real viewer observer returned after its opaque service factory retires", () => {
    const events = emitter();
    let subscription;
    provide({
      targetType: "pdf",
      observeTargets(callback) {
        subscription = events.on("viewer", callback);
        spyOn(subscription, "dispose").and.callThrough();
        main.deactivate();
        return subscription;
      },
    });
    expect(subscription.dispose).toHaveBeenCalledTimes(1);
  });
  it("keeps the entered inversion of a reowned controlled viewer facade during old listener cleanup", () => {
    lumine.config.set("invert-colors.pdfViewState", true);
    const events = emitter(),
      element = document.createElement("div");
    let armed = false;
    const viewer = {
      setInverted(value) {
        element.dataset.inverted = String(value);
      },
      onDidDestroy(callback) {
        const subscription = events.on("dispose", callback);
        return new Disposable(() => {
          subscription.dispose();
          if (armed) {
            armed = false;
            main.activate();
            leases.push(
              main.consumeInversionProvider({
                targetType: "pdf",
                observeTargets(callback) {
                  callback(viewer);
                  return new Disposable();
                },
              }),
            );
          }
        });
      },
    };
    provide({
      targetType: "pdf",
      observeTargets(callback) {
        callback(viewer);
        return new Disposable();
      },
    });
    armed = true;
    main.deactivate();
    expect(main.inversionTargets?.has(viewer)).toBe(true);
    expect(element.dataset.inverted).toBe("true");
  });
  it("releases a real viewer lifetime listener returned after observing it retires the owner", () => {
    const events = emitter();
    let subscription;
    const viewer = {
      setInverted() {},
      onDidDestroy(callback) {
        subscription = events.on("dispose", callback);
        spyOn(subscription, "dispose").and.callThrough();
        main.deactivate();
        return subscription;
      },
    };
    provide({
      targetType: "pdf",
      observeTargets(callback) {
        callback(viewer);
        return new Disposable();
      },
    });
    expect(subscription.dispose).toHaveBeenCalledTimes(1);
  });
});
