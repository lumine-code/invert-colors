# invert-colors

Invert view colors for images, editor, and PDF viewer. Useful for dark themes or reducing eye strain.

## Features

- **Workspace inversion**: invert colors of the entire workspace.
- **Editor inversion**: invert colors of text editors only.
- **Image inversion**: invert colors of `<img>` and `<canvas>` elements.
- **PDF support**: invert open and newly created pdf-view instances without changing pdf-view's global configuration.
- **Animated transitions**: smoothly transition into and out of inverted modes while respecting reduced-motion preferences.
- **Status bar icons**: optional per-mode toggle buttons in the status bar.

## Installation

To install `invert-colors` search for _invert-colors_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/invert-colors`.

## Commands

Commands available in `atom-workspace`:

- `invert-colors:workspace`: toggle workspace inversion,
- `invert-colors:editor`: toggle editor inversion,
- `invert-colors:image`: toggle image inversion,
- `invert-colors:pdfviewer`: toggle PDF viewer inversion.

## Services

- **pdf-view** (`^1.1.0`): consumed to observe PDF viewer instances and toggle their color inversion.
- **status-bar** (`^1.0.0`): consumed to display the optional per-mode toggle buttons in the status bar.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
