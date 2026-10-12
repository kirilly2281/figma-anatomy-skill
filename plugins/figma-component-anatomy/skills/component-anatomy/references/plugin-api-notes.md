# Figma Plugin API notes for anatomy work

Pitfalls the scripts already handle, useful when you extend them.

| Topic | What to do |
|---|---|
| Scaling an instance | `instance.rescale(k)` scales text and nested sizes and keeps it an instance. `resize()` breaks nested sizes. Mark the scale in the name (`@2x`) — `setPluginData` may be unavailable in MCP environments |
| Focus ring | `absoluteBoundingBox` excludes outside strokes, so the ring is drawn separately |
| Clipping radius | an inner `Body` frame usually has radius 0; take the radius from the reference box or the instance and cap it at half the height (a `9999` pill radius becomes `19998` at 2×) |
| Searching inside instances | `findAll` / `findAllWithCriteria` may skip instance internals; walk `children` recursively |
| `setProperties` | full keys contain `#id` (match by the prefix before `#`); variant values are strings, booleans are `true/false`; an impossible combination throws |
| New frames | `figma.createFrame()` has a white fill and `clipsContent = true`: set `fills = []` and `clipsContent = false`, otherwise a white box hides a dark surface or clips a focus ring |
| Hug sizing | `resize()` sets both axes to FIXED; set `primaryAxisSizingMode = 'AUTO'` again for hug frames |
| Bracket with an open bottom | per-side strokes: `strokeTopWeight`, `strokeLeftWeight`, `strokeRightWeight` = 1.5, `strokeBottomWeight` = 0, `dashPattern = [4, 3]` |
| Fill inside the component | a frame with `clipsContent = true` and the component radius, rectangles inside with opacity 0.2 |
| Editing text | load every font of the node (`getRangeAllFontNames`) before changing `characters` |
| Moving a clone between pages | `clone()` creates it on the same page, then `targetPage.appendChild(clone)` |
| Page switching | `await figma.setCurrentPageAsync(page)`; one page switch per `use_figma` call is the safe pattern |
| Screenshots | a separate call: `return await node.screenshot({ scale: 1 })` (or `exportAsync` if your MCP server has no screenshot helper) |
| Overlaps after growth | check top-level frames on the page and move neighbours |

Overlap check for top-level frames:

```js
const ch = figma.currentPage.children, hits = [];
for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) {
  const a = ch[i], b = ch[j];
  const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (ox > 1 && oy > 1) hits.push(a.name + ' × ' + b.name);
}
return hits;
```

Reading the tokens bound to a variant:

```js
const node = await figma.getNodeByIdAsync('VARIANT_ID');
const out = [];
const walk = async n => {
  for (const [prop, b] of Object.entries(n.boundVariables || {})) {
    for (const ref of [].concat(b)) {
      const v = await figma.variables.getVariableByIdAsync(ref.id);
      const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      out.push({ layer: n.name, prop, token: v.name, values: col.modes.map(m => m.name + ': ' + JSON.stringify(v.valuesByMode[m.modeId])) });
    }
  }
  if ('children' in n) for (const c of n.children) await walk(c);
};
await walk(node);
return out;
```

Alias values come back as `{ type: 'VARIABLE_ALIAS', id }`: resolve them with `getVariableByIdAsync` until you reach a literal.
