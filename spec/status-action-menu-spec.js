describe("invert-colors status actions", () => {
  let main, lease, element, tile, window;
  const categories = ["workspace", "editor", "image", "pdfView"];
  const commands = categories.map((key) => `invert-colors:${key === "pdfView" ? "pdf-view" : key}`);

  beforeEach(async () => {
    window = lumine.workspace.getMainWindow();
    jasmine.attachToDOM(window.getElement());
    main = (await lumine.packages.activatePackage("invert-colors")).mainModule;
    for (const category of categories) lumine.config.set(`invert-colors.${category}State`, false);
    lumine.config.set("invert-colors.statusIcon", true);
    lease = main.consumeWindowStatusBar(
      {
        addRightTile({ item }) {
          expect(element).toBeUndefined();
          element = item;
          window.getElement().appendChild(item);
          tile = { destroy: jasmine.createSpy("destroy").and.callFake(() => item.remove()) };
          return tile;
        },
      },
      { window, document: window.getDocument() },
    );
  });

  afterEach(async () => {
    lease.dispose();
    await lumine.packages.deactivatePackage("invert-colors");
    element = undefined;
  });

  function states() {
    return categories.map((category) => lumine.config.get(`invert-colors.${category}State`));
  }

  function menu() {
    return lumine.contextMenu.templateForElement(element);
  }

  it("shows four independent segments for every combination of inversion states", () => {
    expect(element.querySelectorAll("svg").length).toBe(1);
    const segments = [...element.querySelectorAll("path.invert-colors-segment")];
    expect(segments.map((segment) => segment.dataset.mode)).toEqual(categories);
    for (let mask = 0; mask < 16; mask++) {
      const enabled = categories.map((_, index) => Boolean(mask & (1 << index)));
      for (const [index, category] of categories.entries())
        lumine.config.set(`invert-colors.${category}State`, enabled[index]);
      expect(segments.map((segment) => segment.classList.contains("active")))
        .withContext(`state combination ${mask}`)
        .toEqual(enabled);
      expect(
        menu()
          .filter((item) => item.type === "checkbox")
          .map((item) => item.checked),
      )
        .withContext(`menu state combination ${mask}`)
        .toEqual(enabled);
      expect(states()).toEqual(enabled);
      expect(
        commands.map((command) =>
          lumine.commands.getCommandState(command, { target: window.getElement() }),
        ),
      )
        .withContext(`application menu state combination ${mask}`)
        .toEqual(enabled.map((checked) => ({ type: "checkbox", checked })));
    }
  });

  it("offers each mode independently followed by the primary Disable All action", () => {
    const items = menu();
    expect(items.filter((item) => item.command).map((item) => item.command)).toEqual([
      ...commands,
      "invert-colors:disable-all",
    ]);
    expect(items.slice(0, 4).map((item) => item.type)).toEqual(categories.map(() => "checkbox"));
    expect(items[4].type).toBe("separator");
    expect(items[5].command).toBe("invert-colors:disable-all");
    for (const [index, command] of commands.entries()) {
      lumine.commands.dispatch(window.getElement(), command);
      expect(states()).toEqual(categories.map((_, stateIndex) => stateIndex === index));
      expect(
        menu()
          .filter((item) => item.type === "checkbox")
          .map((item) => item.checked),
      ).toEqual(categories.map((_, stateIndex) => stateIndex === index));
      lumine.commands.dispatch(window.getElement(), command);
      expect(states()).toEqual(categories.map(() => false));
    }
    for (const category of categories) lumine.config.set(`invert-colors.${category}State`, true);
    lumine.commands.dispatch(window.getElement(), menu()[5].command);
    expect(states()).toEqual(categories.map(() => false));
  });

  it("disables every mode on left click and stays disabled on a repeated click", () => {
    for (const category of categories) lumine.config.set(`invert-colors.${category}State`, true);
    const dispatch = spyOn(lumine.commands, "dispatch").and.callThrough();
    element.click();
    expect(dispatch).toHaveBeenCalledOnceWith(window.getElement(), "invert-colors:disable-all");
    expect(states()).toEqual(categories.map(() => false));
    expect(element.querySelectorAll(".invert-colors-segment.active").length).toBe(0);
    element.click();
    expect(states()).toEqual(categories.map(() => false));
  });

  it("leaves the current states unchanged on a right click", () => {
    lumine.config.set("invert-colors.workspaceState", true);
    lumine.config.set("invert-colors.pdfViewState", true);
    const before = states();
    const dispatch = spyOn(lumine.commands, "dispatch").and.callThrough();
    element.dispatchEvent(new MouseEvent("click", { button: 2 }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(states()).toEqual(before);
  });

  it("exposes a keyboard button that disables inversion with Enter or Space", () => {
    expect(element.getAttribute("role")).toBe("button");
    expect(element.tabIndex).toBe(0);
    for (const key of ["Enter", " "]) {
      lumine.config.set("invert-colors.workspaceState", true);
      lumine.config.set("invert-colors.pdfViewState", true);
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
      expect(states()).toEqual(categories.map(() => false));
    }
  });

  it("describes the current modes and the disable action in one ordinary tooltip", () => {
    const tooltips = lumine.tooltips.findTooltips(element);
    expect(tooltips.length).toBe(1);
    const [tooltip] = tooltips;
    expect(tooltip.options.keyBindingCommand).toBe("invert-colors:disable-all");
    expect(tooltip.options.keyBindingExtra).toBeUndefined();
    const initial = tooltip.getTitle();
    expect(initial).toMatch(/disable/i);
    lumine.config.set("invert-colors.imageState", true);
    expect(tooltip.getTitle()).not.toBe(initial);
    expect(tooltip.getTitle()).toContain("Images");
    expect(element.getAttribute("aria-label")).toContain("Images");
    for (const category of categories) lumine.config.set(`invert-colors.${category}State`, true);
    for (const label of ["Workspace", "Editors", "Images", "PDF"])
      expect(tooltip.getTitle()).toContain(label);
  });

  it("releases the tile, tooltip, menu and click handler when the service lease ends", () => {
    lumine.config.set("invert-colors.imageState", true);
    lease.dispose();
    expect(tile.destroy).toHaveBeenCalledTimes(1);
    expect(element.isConnected).toBe(false);
    expect(element.onclick).toBeNull();
    expect(element.onkeydown).toBeNull();
    expect(lumine.tooltips.findTooltips(element)).toEqual([]);
    expect(menu()).toEqual([]);
    element.click();
    expect(lumine.config.get("invert-colors.imageState")).toBeTrue();
    lease.dispose();
    expect(tile.destroy).toHaveBeenCalledTimes(1);
  });
});
