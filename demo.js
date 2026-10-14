// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript", "status-bar"],
  viewport: { width: 1100, height: 730 },
  async before({ lumine }) {
    lumine.config.set("invert-colors.statusIcon", true);
    for (const category of ["workspace", "editor", "image", "pdfView"]) {
      lumine.config.set(`invert-colors.${category}State`, false);
    }
  },
  async prepare(context) {
    const { state, open } = context;
    state.editor = await open("usage/inverted.js");
  },
  scenes: [
    {
      id: "status-indicator",
      file: "demo.png",
      caption: "Track workspace, editor, image and PDF inversion in one status bar indicator.",
      timeout: 60000,
      async run({ command }) {
        command("invert-colors:disable-all");
      },
      ready() {
        return Boolean(
          document.querySelector(".invert-colors-status svg")?.getBoundingClientRect().height > 0 &&
          document.querySelectorAll(".invert-colors-segment[data-mode]").length === 4 &&
          document.querySelectorAll(".invert-colors-segment.active").length === 0 &&
          !document.body.classList.contains("invert-colors-editor"),
        );
      },
    },
    {
      id: "editor-inversion",
      file: "demo-2.png",
      caption: "Invert text editor colors while the indicator shows the active category.",
      timeout: 60000,
      async run({ command }) {
        command("invert-colors:editor");
      },
      ready() {
        return Boolean(
          document.body.classList.contains("invert-colors-editor") &&
          document.querySelector(".invert-colors-status svg")?.getBoundingClientRect().height > 0 &&
          document.querySelectorAll(".invert-colors-segment.active").length === 1 &&
          document.querySelector('.invert-colors-segment[data-mode="editor"].active'),
        );
      },
    },
  ],
  async cleanup({ command }) {
    command("invert-colors:disable-all");
  },
};
