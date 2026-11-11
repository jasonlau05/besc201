# Color palette variants

The original palette remains active. Each alternative is a complete replacement
with the same 193 CSS variables. The files change colors only; layouts, content,
interactions, and opacity values stay the same. Calculator status colors and chat
error colors keep their existing values in every variant.

| File in `src/` | Palette | Primary | Accent | Background |
| --- | --- | --- | --- | --- |
| `palette.css` | Original: forest and terracotta | `#276554` | `#c9633f` | `#f8f7f3` |
| `palette2.css` | Ocean: blue and coral | `#245b91` | `#b65032` | `#f4f7fb` |
| `palette3.css` | Orchard: plum and amber | `#6b3e75` | `#9a6514` | `#faf7fc` |
| `palette4.css` | Harbor: slate and teal | `#364858` | `#14766d` | `#f5f7f8` |
| `palette5.css` | Harvest: cranberry, leaf and cream | `#c33149` | `#9d263c` | `#f3d9b1` |

Harvest uses the exact requested `#C33149` for primary actions, `#A8C256` for
leaf highlights, and `#F3D9B1` for the page background. Deeper cranberry and olive
shades provide text and accents against the lighter backgrounds.

## Switch a palette

In `src/main.jsx`, replace the existing palette import with the desired file:

```js
import './palette2.css'
```

Import exactly one palette. To restore the original, use:

```js
import './palette.css'
```

The development server updates after saving. For a deployed comparison, rebuild
with the chosen import.

## Compare colors

Use the same pages, content, and tasks for each variant. Check `/`, `/learn`,
`/info`, and the open chat panel, including hover and keyboard focus states.

These files prepare the color variants. Visitor assignment, experiment tracking,
and result collection are not configured.
