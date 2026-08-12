# Slot runtime layers

The 3-of-4 slot keeps the appearance of `references/theatre-slot-housing-3of4-v1-1024.png` and uses only existing reel and symbol art.

The folder intentionally has only two subfolders:

- `references/`: preserved concept sheets and source images
- `symbols/`: flattened runtime symbol icons

## Render order

1. `slot-reel-repeat-strip.png`
2. `slot-reel-window-mask.png`
3. `slot-machine-housing.png`
4. `slot-reroll-button-1.png` through `slot-reroll-button-3.png`

`slot-machine-3of4-assembled.png` is the single review composite. At runtime, each active reel scrolls a copy of the repeat strip independently behind the window mask. The fourth compartment is the fixed locked curtain in the housing layer.

## Reel repeat

- Strip size: `512x1120`
- Cell height: `280px`
- Wrap scrolling offset with `offsetY % 280` for a seamless loop.
- Use three independently controlled strip instances for the minimum three-reel state.

## Individual reroll controls

- Visual layers: `slot-reroll-button-1.png`, `slot-reroll-button-2.png`, `slot-reroll-button-3.png`
- Click-area guide: `slot-reroll-hit-mask.png`
- Each hit area is approximately `80x92px` on the aligned `1024x592` canvas.
- Suggested click motion: move the selected button down `3px` for `70ms`, then rebound for `110ms`; only the corresponding reel spins.
