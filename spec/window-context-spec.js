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
  it("creates controls in future windows and removes only that package's controls on unload", async () => {
    const main = lumine.workspace.getMainWindow();
    const extra = await lumine.workspace.openEditorWindow({ show: false });
    expect(main.getElement().querySelector(".invert-colors-status")).not.toBeNull();
    const element = extra.getElement().querySelector(".invert-colors-status");
    expect(element).not.toBeNull();
    expect(element.ownerDocument).toBe(extra.getDocument());
    await lumine.packages.deactivatePackage("invert-colors");
    for (const window of lumine.workspace.getWindows())
      expect(window.getElement().querySelector(".invert-colors-status")).toBeNull();
    expect(extra.getElement().querySelector("status-bar")).not.toBeNull();
  });
});
