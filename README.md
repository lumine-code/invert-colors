# invert-colors

Invert view colors for images, editors, and the PDF viewer.

Useful for dark themes or reducing eye strain.

## Features

- **Workspace inversion**: invert colors of the entire workspace.
- **Editor inversion**: invert colors of text editors only.
- **Image inversion**: invert colors of every `<img>`, and of the canvases that draw a picture rather than a live view.
- **PDF support**: invert open and newly created pdf-view instances without changing pdf-view's global configuration.
- **Animated transitions**: smoothly transition into and out of inverted modes while respecting reduced-motion preferences.
- **Status bar icons**: optional per-mode toggle buttons in the status bar.

## Installation

To install `invert-colors` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/invert-colors`.

## Commands

Commands available in `lumine-workspace`:

- `invert-colors:workspace`: toggle workspace inversion,
- `invert-colors:editor`: toggle editor inversion,
- `invert-colors:image`: toggle image inversion,
- `invert-colors:pdf-view`: toggle PDF viewer inversion.

## Customization

Image inversion covers every `<img>`, and only the canvases it knows to be pictures — a canvas is far more often a live renderer such as the minimap, the terminal or a 3D viewport, whose colors already come from the theme. To invert one it does not know about, name it in `styles.css`:

```css
body.invert-colors-image .my-package canvas {
  filter: invert(100%) !important;
}
```

## Services

- `pdf-view`: consumed to observe PDF viewer instances and toggle their color inversion.
- `status-bar`: consumed to display the optional per-mode toggle buttons in the status bar.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
