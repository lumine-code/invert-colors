describe("invert-colors status actions", () => {
  let main, lease, elements;
  const categories = ["workspace", "editor", "image", "pdfView"];
  const commands = categories.map((key) => `invert-colors:${key === "pdfView" ? "pdf-view" : key}`);
  beforeEach(async () => {
    const window = lumine.workspace.getMainWindow();
    jasmine.attachToDOM(window.getElement());
    main = (await lumine.packages.activatePackage("invert-colors")).mainModule;
    for (const category of categories) {
      lumine.config.set(`invert-colors.${category}State`, false);
      lumine.config.set(`invert-colors.${category}StatusIcon`, true);
    }
    elements = [];
    lease = main.consumeWindowStatusBar(
      {
        addRightTile({ item }) {
          elements.push(item);
          window.getElement().appendChild(item);
          return { destroy: () => item.remove() };
        },
      },
      { window, document: window.getDocument() },
    );
  });
  afterEach(async () => {
    lease.dispose();
    await lumine.packages.deactivatePackage("invert-colors");
  });
  it("offers every global category from every icon, including the real PDF command", () => {
    for (const [index, element] of elements.entries()) {
      expect(lumine.contextMenu.templateForElement(element).map((item) => item.command)).toEqual(
        commands,
      );
      expect(
        lumine.contextMenu.templateForElement(element).map((item) => item.mouseBindingLabel),
      ).toEqual(
        categories.map((_, categoryIndex) => (categoryIndex === index ? "LMB" : undefined)),
      );
      element.dispatchEvent(new MouseEvent("click", { button: 2 }));
    }
    expect(categories.map((key) => lumine.config.get(`invert-colors.${key}State`))).toEqual([
      false,
      false,
      false,
      false,
    ]);
    elements[3].click();
    for (const element of elements)
      expect(lumine.contextMenu.templateForElement(element).map((item) => item.checked)).toEqual([
        false,
        false,
        false,
        true,
      ]);
    const [tooltip] = lumine.tooltips.findTooltips(elements[3]);
    expect(tooltip.options.keyBindingCommand).toBeUndefined();
    expect(tooltip.getTitle()).toContain("All PDFs");
    expect(tooltip.getTitle()).toContain("Click to toggle inversion.");
  });
  it("releases all four menus when the service lease ends", () => {
    lease.dispose();
    for (const element of elements)
      expect(lumine.contextMenu.templateForElement(element)).toEqual([]);
  });
});
