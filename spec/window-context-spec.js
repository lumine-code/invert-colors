describe("invert-colors window status", () => {
  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.workspace.getElement());
    await lumine.packages.activatePackage("status-bar");
    lumine.config.set("invert-colors.workspaceStatusIcon", true);
    await lumine.packages.activatePackage("invert-colors");
  });
  afterEach(async () => {
    await lumine.workspace.discardEditorWindows();
  });
  it("keeps global controls in main while applying inversion to every window", async () => {
    const main = lumine.workspace.getMainWindow();
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    expect(main.getElement().querySelector(".invert-colors-status")).not.toBeNull();
    expect(extra.getElement().querySelector(".invert-colors-status")).toBeNull();
    main.getElement().querySelector(".invert-colors-status").click();
    expect(lumine.config.get("invert-colors.workspaceState")).toBeTrue();
    expect(main.getDocument().body.classList.contains("invert-colors-workspace")).toBeTrue();
    expect(extra.getDocument().body.classList.contains("invert-colors-workspace")).toBeTrue();
    const future = await lumine.workspace.openEditorWindow({ show: false });
    expect(future.getElement().querySelector(".invert-colors-status")).toBeNull();
    expect(future.getDocument().body.classList.contains("invert-colors-workspace")).toBeTrue();
    await lumine.packages.deactivatePackage("invert-colors");
    for (const window of lumine.workspace.getWindows())
      expect(window.getElement().querySelector(".invert-colors-status")).toBeNull();
    expect(extra.getElement().querySelector("status-bar")).not.toBeNull();
  });
});
