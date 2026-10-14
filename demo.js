// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-javascript"],
  viewport: { width: 1100, height: 730 },
  async before() {},
  async prepare(context) {
    const { state, open } = context;
    state.editor = await open("usage/inverted.js");
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Invert the text editor colors independently of the surrounding interface.",
      timeout: 60000,
      async run() {},
      ready() {
        return Boolean(
          document.querySelector("lumine-workspace")?.getBoundingClientRect().height > 0 &&
          document.body.innerText.trim().length > 0,
        );
      },
    },
    {
      id: "scene-2",
      file: "demo-2.png",
      caption: "Invert the text editor colors independently of the surrounding interface.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          lumine.commands.dispatch(lumine.views.getView(state.editor), "invert-colors:editor");
        }
      },
      ready() {
        return Boolean(document.body.classList.contains("invert-colors-editor"));
      },
    },
  ],
  async cleanup(context) {
    const { lumine } = context;
    lumine.commands.dispatch(lumine.workspace.getElement(), "invert-colors:editor");
  },
};
