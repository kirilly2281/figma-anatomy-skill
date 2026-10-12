---
name: component-anatomy
description: Build or update a component anatomy page in a Figma UI kit — the component at 2× with pink annotations for paddings, gaps and dimensions, blue annotations for text and icon sizes, a Specs table (name · token · value) and Usage do's and don'ts. Ships ready-made Figma Plugin API scripts for the use_figma tool, with an automatic geometry check so labels never collide. Use when documenting a component's structure, spacing, sizes or tokens in Figma.
---

# Component anatomy in Figma

Input: a Figma file with the component (component set, component or instance) and, ideally, its variables (tokens). Output: a frame `Documentation / <Name> anatomy` with 3–5 annotated examples, a Specs table per example and a Usage list, checked for label collisions.

Requirements: a Figma MCP server that exposes the `use_figma` tool (Plugin API execution). Before writing to Figma, load the `figma-use` skill if it is available and follow its rules. Everything here runs through `use_figma`: paste a script file **whole** and edit only its `CFG` block.

| Script | What it does |
|---|---|
| [anatomy-page.js](scripts/anatomy-page.js) | Creates the anatomy frame from scratch: header, legend, blocks (Example + Specs), Usage. Returns the block ids |
| [anatomy-annotate.js](scripts/anatomy-annotate.js) | Scales the instance, measures elements, draws pink and blue annotations, checks geometry, returns `conflicts` |
| [anatomy-specs.js](scripts/anatomy-specs.js) | Fills the Specs table of one block: dot · name · token chip · value |

Configuration reference, recipes for different component types and troubleshooting: [anatomy-guide.md](references/anatomy-guide.md). Plugin API pitfalls: [plugin-api-notes.md](references/plugin-api-notes.md).

## Annotation standard

Two colours, the value inside a pill, no numbered callouts. Each zone **overlaps the component** so it is clear which area is highlighted, while **lines of different labels never cross or touch**.

**Different measurements use different techniques** (mixing them is what makes anatomy unreadable):

| Measurement | How it is shown |
|---|---|
| Top and bottom paddings (vertical) | Only a light pink fill (opacity 0.2) inside the component as a full-width band, clipped to the component silhouette. Outside on the right — a thin solid `]` bracket with a pill. No dashes |
| Left, right paddings and gaps (horizontal) | Only a dashed bracket (top and both sides, open bottom) from a lane above the component down to the vertical centre of the content row. No fill |
| Height and width | Arrow with ticks (right and bottom), pill on the line, the line breaks around the pill |
| Text and icon size | Blue leader from the element down (or up), a dot on the element, pill in the lane |
| Focus ring | Translucent ring over the stroke area and a pill `2` with a leader below |

- **Colours:** pink `#E8457D` — paddings and dimensions; blue `#1F6BEB` — text and icon sizes (`16 px`, `24 px`). A two-dot legend sits under the section title; Specs rows are marked with a coloured dot (pink, blue, grey for colour values).
- **Pill:** auto layout, radius 100, padding 9/4, white semibold 13 px text.
- **Component at 2×** (`instance.rescale(2)`, it stays an instance); measurements come from `absoluteBoundingBox`, pills show real 1× values.
- **Clearance rule:** ≥ 1 px between lines of different labels, ≥ 3 px between pills. Right-hand brackets sit 14 px from the component, ticks are 8 px. If neighbouring pills come closer than 5 px, the second one moves one level up and gets a thin connector.
- **The check is mandatory:** the script registers every line and pill by label group and tests all pairs of different groups. A screenshot does not replace this check.
- Layers: `Annotations` → `Pink · spacing and dimensions` (fills, brackets, arrows), `Blue · text and icons`. Example width 700 px (`exampleWidth`), anatomy frame width = `exampleWidth` + 960 = 1660. Wide components widen the whole frame so every block keeps the same scale.

## Workflow

1. **Read the component.** Component set, `componentPropertyDefinitions`, the inner layer structure (which frame holds the content row), bound variables (`boundVariables`) and their values per mode.
2. **Pick 3–5 examples** that differ in **structure**, not in state (states belong to the variants table). Example for a button: large with two icons, medium with a counter, small, focused. Block title: "Size · Type · feature".
3. **Build the page:** run `anatomy-page.js` with `name`, `blocks` (node id + props), `usage`. It returns the block ids and a ready `CFG` line for the next step. If a block warns that the component is too wide for 2×, raise `exampleWidth` for the whole frame.
4. **Annotate:** run `anatomy-annotate.js` with `page` and `blocks`. Add per-block settings only when the defaults do not fit (see the recipes in the guide). The script is idempotent: never draw lines by hand, change `CFG` and run it again.
5. **Read the result.** For every block: `conflicts` must be empty; `zones` (horizontal values) and `vertical` (vertical values) must match the tokens. A mismatch means the wrong frame or element is treated as the row — fix `rowOf` / `rowsOf` / `classify`.
6. **Fill Specs:** run `anatomy-specs.js` per block. Take tokens from the variant's `boundVariables` and values from the collection modes, never from memory. Several modes: `20 / 16 / 12` (Desktop / Tablet / Mobile).
7. **Usage:** 3–6 plain-language ✓ / ✕ statements for designers: when to use, what not to do.
8. **Verify the page** (below) and show the user a screenshot of every block (`await node.screenshot({ scale })` in a separate `use_figma` call).

## Checklist

- `conflicts` is empty for every block.
- Pill values equal the token values at 1× in the current mode.
- Anatomy frame width = `exampleWidth` + 960, one legend, top-level frames on the page do not overlap (the frame grows; move neighbours).
- Every example is still an instance (name ends with `@Nx`), not detached.
- Every token name in Specs exists (local variables, library variables, text styles).
- Usage is written for designers, not engineers.

## Don'ts

- Dashed outlines for top and bottom bands (they cross the side brackets).
- Fills for horizontal zones (fill + dashes duplicate each other).
- An arrow line running under its pill.
- Accepting a screenshot without checking `conflicts`.
- `resize()` to scale an instance: use `rescale()` (exception: `width` when the block sets a width on purpose).
- Showing a space-between gap or a media height as a padding: filter them with `zoneFilter` / `bandFilter`.
