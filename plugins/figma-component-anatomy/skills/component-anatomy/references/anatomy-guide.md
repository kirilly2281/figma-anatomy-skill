# Anatomy: configuration, recipes, troubleshooting

Visual rules live in [SKILL.md](../SKILL.md#annotation-standard). This file covers the frame layout, every `CFG` field and how to adapt the scripts to different component structures.

## Frame layout

`Documentation / <Name> anatomy` is a vertical auto-layout frame, width `exampleWidth` + 960 (1660 by default):

1. `Header` — category caption and title `<Name> anatomy`, full width.
2. `Content` (padding 96, gap 32): title `Structure <name>` (24 px), `Legend` (pink and blue dots, 13 px), blocks, title `Usage` (24 px) and ✓ / ✕ lines (14 px).
3. **Block** — horizontal frame, gap 32:
   - `Example`: `exampleWidth` wide, fill `#F8F8F8`, radius 8, a small block title in the top-left corner, the instance (`… @2x`) and the `Annotations` layer. Not an auto-layout frame: the script positions children absolutely.
   - `Specs` (fills the rest, 736 px): header row `Name | Token | Value`, data rows (dot · name · token chip · value), a 12 px note under the table.

`anatomy-page.js` builds exactly this. You can also build it by hand or restyle it, as long as the names `Content`, `Example`, `Specs` and the row structure (4 children: dot text, name text, token cell with a frame named `… chip` or an instance, value text) are kept.

## `anatomy-page.js`

| Field | Value |
|---|---|
| `page` | page id; `null` — current page |
| `name`, `category` | component name and header caption |
| `blocks[]` | `{ title, node, props }`: `node` — component set (default variant is used), component or instance (cloned with overrides); `props` — property names without `#id`, variant values as strings, booleans as `true/false` |
| `usage` | array of ✓ / ✕ lines |
| `exampleWidth` | Example width for all blocks (700 by default). 2× needs ≥ 2·W + 290, where W is the component width |
| `position` | `{ x, y }` or `null` (to the right of existing content) |
| `font`, `legend` | font family (falls back to Inter) and the two legend captions |
| `replace` | remove an existing frame with the same name first |

## `anatomy-annotate.js`

| Field | Value |
|---|---|
| `page` | page id |
| `blocks[].block` | block frame id (Example + Specs) |
| `blocks[].focused` | `true`: translucent ring over the stroke area and a pill `2` with a leader; `ring` — thickness (2 by default), `ringX` — leader position from the left edge |
| `blocks[].create` | `{ set, props, name }`: recreate the instance from a component set or component |
| `blocks[].title` | block title |
| `blocks[].boxOf(inst)` | reference frame whose size is the component size. Default: the instance itself |
| `blocks[].rowOf(inst)` | node whose visible children are the elements of the row (left to right). Default: the first child of the instance |
| `blocks[].rowsOf(inst)` | a stack: several rows `[[nodes], [nodes]]` top to bottom (label, field, helper text). Vertical bands are built between rows |
| `blocks[].classify(node, scale)` | custom element parser → `[{ kind: 'text'/'icon'/'other', node, font?, size?, extra? }]`. `other` produces paddings only |
| `blocks[].ref` | index of the row used for horizontal zones (default: the widest) |
| `blocks[].zoneRowOf(inst)` | nodes of a separate row for horizontal zones when it differs from the stack rows |
| `blocks[].edges` | `{ left, right }`: switch off an edge zone |
| `blocks[].zoneFilter(w, k)`, `.bandFilter(zone)` | drop unwanted horizontal zones or vertical bands |
| `blocks[].vertical` | `'both'` · `'top'` · `'bottom'` · `'none'`: which vertical bands to draw |
| `blocks[].blue(item, rowIndex)` | filter for blue labels (e.g. only the first page number) |
| `blocks[].backdrop` | `true` or `{ fill, pad, radius }`: a dark surface under components made for dark backgrounds |
| `blocks[].props` / `.width` | instance properties set before measuring (`{ Label: false }`) and a fixed width |
| `blocks[].kinds` | Specs dot colour by row name: `{ 'Size': 'blue', 'Color': 'grey' }` |
| `blocks[].exampleWidth`, `.scale`, `.lanes` | per-block overrides |
| `exampleWidth`, `lanes`, `scale` | frame-wide defaults: 700; `{ left: 80, top: 130, right: 210, bottom: 230 }`; `null` = 2× if it fits, otherwise 1× |
| `font`, `legend`, `specs` | pill / legend font, legend captions, recolour Specs markers (`true`) |

The result per block: `scale`, `example` (size), `rows` (detected elements with x ranges), `ref`, `zones` (horizontal values), `vertical` (vertical values), `dots`, `conflicts`.

How it works: the current scale is read from the `@Nx` suffix of the instance name, so re-running never compounds the scale. The content zone of a row is the union of the vertical bounds of its elements. For a text element the frame is used if it fills the width (`layoutSizingHorizontal = FILL`), otherwise the text node itself; blue leaders point at the actual glyphs.

Default classification by layer name: text — `Text`, `Label`, `Value`, `Title`, `Caption`, `Placeholder`, `Suffix`, `Content`; icon — names containing `Icon`, `Arrow`, `Chevron`, `Check`, `Close`, `Clear`, `Separator`, `Loader`; frames ending with `Side` or `Group` are expanded; hidden and absolutely positioned children are skipped; everything else is `other`. If your layers are named differently, pass `classify`.

## `anatomy-specs.js`

| Field | Value |
|---|---|
| `page`, `block` | page and block ids |
| `rows[]` | `{ name, token, value, kind }`; `token: '—'` — no token; `kind`: `pink` / `blue` / `grey` |
| `note` | string — replace the note, `''` — remove it, `null` — keep |
| `templateFrom` | block id to copy a standard Specs table from, if this block has none |

## Recipes

| Component structure | Settings |
|---|---|
| Button-like: instance → `Body` frame → icon, label, icon | defaults; focused state: `focused: true` |
| Elements are direct children of the instance (badge, tag, chip, counter, icon button) | `rowOf: i => i` |
| Single icon | `scale: 4`, `rowOf: i => i`, `classify: (c, cur) => [{ kind: 'icon', node: c, size: Math.round(c.parent.width / cur) }]`, `kinds: { Size: 'blue', Color: 'grey' }` |
| Segmented control | segment: `rowOf: i => i`; group: `rowOf: i => i` (segments become `other`, zones show the gaps) |
| Breadcrumbs, pagination | `rowOf: i => i`; expand wrapper frames in `classify`; `blue` only for the first item; wide rows need a larger `exampleWidth` |
| Label + value stack (meta) | `rowsOf: i => [[i.children[0]], [i.children[1]]]` |
| Input with label and helper text | single field: `props: { Label: false, Caption: false }`; full stack: `rowsOf` [label, field, helper], `ref: 1`, `edges: { left: false, right: false }` |
| Field inside a wrapper with outer spacing | `boxOf: i => i.findOne(n => n.name === 'Field')` so the wrapper does not count as padding |
| Dropdown / menu container | `rowsOf` [search, list, buttons], `ref` = the buttons row, `lanes: { top: 170 }`; the search bar as `other` with `extra` for its icon and text |
| Textarea | stack `rowsOf` [label, input, helper], `ref: 1`, `zoneRowOf` — the text and the scroll/icon column |
| Checkbox / radio with a label | `width: 160`, `edges: { right: false }`, `classify`: the control as an icon, the label as text |
| Card | `rowsOf` per content row, `ref` = the most informative row, `scale: 1`, wider `exampleWidth`, `bandFilter` to hide the media height, `zoneFilter` to hide a space-between gap |
| Component for dark backgrounds | `backdrop: true` or `{ fill, pad, radius }` |

Example of a block with a custom parser:

```js
{
  block: 'BLOCK_ID',
  rowOf: i => i,
  classify: (c, cur) => c.name === 'Control'
    ? [{ kind: 'icon', node: c, size: Math.round(c.width / cur) }]
    : c.type === 'TEXT' ? [{ kind: 'text', node: c, font: Math.round(c.fontSize / cur) }] : [],
  edges: { right: false }
}
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `conflicts`: pills of neighbouring zones | the script already lifted the second pill; if still crowded — `scale: 1` or a wider `exampleWidth` |
| `conflicts`: `vb:top × vb:bottom` | the component fell back to 1× because `exampleWidth` < 2·W + 290; widen the whole frame so all blocks keep one scale |
| `conflicts`: line × pill | increase `lanes.top` / `lanes.bottom` |
| zones of zero or extra width | check `rowOf` / `classify`: the row must contain only visible elements |
| error "does not fit" | larger `exampleWidth` or `scale: 1` |
| pill values differ from tokens | the wrong frame is the row or the box; use `boxOf`, `rowOf`, `rowsOf` |
| vertical band mixes inner padding and outer gap | build the stack row from the whole frame (`other`) and expose its inner elements through `extra` |
| "Property not found" | property names without `#id`; variant values are strings (`'True'`, `'Large'`) |
| font error | set `font` to a family present in the file, or add Inter |
