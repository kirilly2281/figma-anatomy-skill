// anatomy-page.js — builds an empty anatomy documentation frame for one component.
// Usage: paste the whole file into the use_figma tool (Figma Plugin API) and edit only CFG.
// Result: a frame "Documentation / <Name> anatomy" with a header, legend, one block per example
// (Example on the left, Specs table on the right) and a Usage list. The script returns block ids:
// pass them to anatomy-annotate.js (annotations) and anatomy-specs.js (spec rows).
const CFG = {
  page: null,                                      // page id; null — the current page
  name: 'Button',                                  // component name used in titles
  category: 'DOCUMENTATION',                       // small caption above the title
  blocks: [
    // One block per structurally different example (not per state).
    // node: component set id (its default variant is used), component id, or an instance id (cloned as is).
    // props: variant / boolean / text properties without the "#id" suffix; variant values are strings.
    { title: 'Large · Primary · two icons', node: 'COMPONENT_SET_ID', props: { Size: 'Large' } },
    { title: 'Small · Secondary', node: 'COMPONENT_SET_ID', props: { Size: 'Small' } }
  ],
  usage: [
    '✓ Use for the main action on a screen.',
    '✕ Do not place two primary buttons side by side.'
  ],
  exampleWidth: 700,                               // width of every Example frame; anatomy frame width = exampleWidth + 960
  position: null,                                  // { x, y }; null — to the right of existing content on the page
  font: 'Inter',                                   // any font family available in the file; falls back to Inter
  legend: ['Pink — spacing and dimensions, px', 'Blue — text and icon sizes, px'],
  replace: true                                    // remove an existing frame with the same name before building
};

const PINK = { r: 0.91, g: 0.27, b: 0.49 }, BLUE = { r: 0.12, g: 0.42, b: 0.92 }, GREY = { r: 0.35, g: 0.38, b: 0.45 };
const INK = { r: 0.1, g: 0.11, b: 0.13 }, LINE = { r: 0.9, g: 0.91, b: 0.93 }, CHIP = { r: 0.94, g: 0.95, b: 0.96 };
const WHITE = { r: 1, g: 1, b: 1 }, EXAMPLE_BG = { r: 0.973, g: 0.973, b: 0.973 }, HEADER_BG = { r: 0.96, g: 0.96, b: 0.97 };

// ---------- helpers ----------
async function resolveFonts(family) {
  const tryLoad = async f => { try { await figma.loadFontAsync(f); return f; } catch (e) { return null; } };
  const pick = async styles => {
    for (const fam of [family, 'Inter']) for (const s of styles) { const f = await tryLoad({ family: fam, style: s }); if (f) return f; }
    throw new Error('No usable font: add ' + family + ' or Inter to the file');
  };
  return { regular: await pick(['Regular']), bold: await pick(['DemiBold', 'SemiBold', 'Semi Bold', 'Medium', 'Bold']) };
}
function autoFrame(dir, name, spacing) {
  const f = figma.createFrame(); f.name = name; f.layoutMode = dir; f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = spacing || 0; f.fills = []; f.clipsContent = false; return f;
}
function text(s, size, font, color) {
  const t = figma.createText(); t.fontName = font; t.fontSize = size; t.characters = s; t.fills = [{ type: 'SOLID', color }]; return t;
}
const key = (i, n) => Object.keys(i.componentProperties).find(k => k.split('#')[0] === n);
function setProps(inst, props) {
  const m = {}; for (const [n, v] of Object.entries(props || {})) { const k = key(inst, n); if (!k) throw new Error('Property not found: ' + n); m[k] = v; }
  if (Object.keys(m).length) inst.setProperties(m);
}
function fixWidth(n, w) { n.layoutSizingHorizontal = 'FIXED'; n.resize(w, n.height); }

// ---------- setup ----------
const page = CFG.page ? await figma.getNodeByIdAsync(CFG.page) : figma.currentPage;
if (!page || page.type !== 'PAGE') throw new Error('CFG.page is not a page id');
if (page !== figma.currentPage) await figma.setCurrentPageAsync(page);
const F = await resolveFonts(CFG.font);
const frameName = 'Documentation / ' + CFG.name + ' anatomy';
if (CFG.replace) for (const n of page.children.filter(n => n.name === frameName)) n.remove();

// ---------- frame ----------
const W = CFG.exampleWidth + 960;                  // Example + gap 32 + Specs 736 + paddings 192
const doc = autoFrame('VERTICAL', frameName, 0); doc.fills = [{ type: 'SOLID', color: WHITE }];
doc.resize(W, 100); doc.counterAxisSizingMode = 'FIXED'; doc.primaryAxisSizingMode = 'AUTO';

const header = autoFrame('VERTICAL', 'Header', 8); header.fills = [{ type: 'SOLID', color: HEADER_BG }];
header.paddingLeft = header.paddingRight = 96; header.paddingTop = 56; header.paddingBottom = 48;
doc.appendChild(header); header.layoutSizingHorizontal = 'FILL';
header.appendChild(text(CFG.category, 12, F.bold, GREY)); header.appendChild(text(CFG.name + ' anatomy', 40, F.bold, INK));

const content = autoFrame('VERTICAL', 'Content', 32); content.paddingLeft = content.paddingRight = content.paddingTop = content.paddingBottom = 96;
doc.appendChild(content); content.layoutSizingHorizontal = 'FILL';
content.appendChild(text('Structure ' + CFG.name, 24, F.regular, INK));

const legend = autoFrame('HORIZONTAL', 'Legend', 20); legend.counterAxisAlignItems = 'CENTER'; content.appendChild(legend);
[[PINK, CFG.legend[0]], [BLUE, CFG.legend[1]]].forEach(([col, s]) => {
  const g = autoFrame('HORIZONTAL', 'Legend item', 8); g.counterAxisAlignItems = 'CENTER';
  const d = figma.createEllipse(); d.resize(10, 10); d.fills = [{ type: 'SOLID', color: col }]; g.appendChild(d);
  g.appendChild(text(s, 13, F.regular, GREY)); legend.appendChild(g);
});

// ---------- blocks ----------
function specRow(name, cells, header) {
  const r = autoFrame('HORIZONTAL', name, 12); r.counterAxisAlignItems = 'CENTER';
  r.paddingLeft = r.paddingRight = 12; r.paddingTop = r.paddingBottom = 7; try { r.minHeight = 36; } catch (e) { }
  r.strokes = [{ type: 'SOLID', color: LINE }]; r.strokeAlign = 'INSIDE';
  r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = header ? 1.5 : 1;
  const [dot, nm, token, value] = cells;
  r.appendChild(dot); fixWidth(dot, 16); dot.textAutoResize = 'HEIGHT';
  r.appendChild(nm); nm.layoutSizingHorizontal = 'FILL'; nm.textAutoResize = 'HEIGHT';
  r.appendChild(token); fixWidth(token, 240); token.layoutSizingVertical = 'HUG';
  r.appendChild(value); fixWidth(value, 180); value.textAutoResize = 'HEIGHT';
  return r;
}
function tokenCell(content) { const c = autoFrame('HORIZONTAL', 'Token', 0); c.counterAxisAlignItems = 'CENTER'; c.appendChild(content); return c; }
function chip(s) {
  const c = autoFrame('HORIZONTAL', 'Token chip', 0); c.paddingLeft = c.paddingRight = 8; c.paddingTop = c.paddingBottom = 3; c.cornerRadius = 4;
  c.fills = [{ type: 'SOLID', color: CHIP }]; c.appendChild(text(s, 12, F.regular, INK)); return c;
}

const blockIds = [], warnings = [];
for (const b of CFG.blocks) {
  const blk = autoFrame('HORIZONTAL', 'Block / ' + b.title, 32); blk.counterAxisAlignItems = 'MIN';
  content.appendChild(blk); blk.layoutSizingHorizontal = 'FILL';

  const ex = figma.createFrame(); ex.name = 'Example'; ex.resize(CFG.exampleWidth, 360); ex.cornerRadius = 8; ex.clipsContent = false;
  ex.fills = [{ type: 'SOLID', color: EXAMPLE_BG }]; blk.appendChild(ex);
  const title = text(b.title, 11, F.regular, GREY); ex.appendChild(title); title.x = 16; title.y = 14;

  const src = await figma.getNodeByIdAsync(b.node);
  if (!src) throw new Error('Node not found: ' + b.node + ' (block "' + b.title + '")');
  let inst;
  if (src.type === 'COMPONENT_SET') { inst = src.defaultVariant.createInstance(); inst.name = src.name; }
  else if (src.type === 'COMPONENT') { inst = src.createInstance(); inst.name = src.parent && src.parent.type === 'COMPONENT_SET' ? src.parent.name : src.name; }
  else if (src.type === 'INSTANCE') inst = src.clone();
  else throw new Error('Block "' + b.title + '": node must be a component set, component or instance');
  ex.appendChild(inst); setProps(inst, b.props); inst.x = 80; inst.y = 130;
  if (inst.width * 2 > CFG.exampleWidth - 290) warnings.push('"' + b.title + '" is ' + Math.round(inst.width) + ' px wide: it will be shown at 1× unless exampleWidth ≥ ' + Math.ceil(inst.width * 2 + 290));

  const specs = autoFrame('VERTICAL', 'Specs', 0); blk.appendChild(specs); specs.layoutSizingHorizontal = 'FILL';
  specs.appendChild(specRow('Header', [text('', 12, F.bold, GREY), text('Name', 12, F.bold, GREY), tokenCell(text('Token', 12, F.bold, GREY)), text('Value', 12, F.bold, GREY)], true));
  const dot = text('●', 12, F.regular, PINK);
  specs.appendChild(specRow('Row', [dot, text('Element', 13, F.regular, INK), tokenCell(chip('token/name')), text('—', 13, F.regular, INK)]));
  for (const r of specs.children) r.layoutSizingHorizontal = 'FILL';
  const note = text('Values at 1×. Several modes: Desktop / Tablet / Mobile.', 12, F.regular, GREY);
  specs.appendChild(note); note.layoutSizingHorizontal = 'FILL'; note.textAutoResize = 'HEIGHT';
  blockIds.push(blk.id);
}

// ---------- usage ----------
content.appendChild(text('Usage', 24, F.regular, INK));
const list = autoFrame('VERTICAL', 'Usage list', 10); content.appendChild(list);
for (const s of CFG.usage) list.appendChild(text(s, 14, F.regular, INK));

// ---------- position ----------
const others = page.children.filter(n => n !== doc);
if (CFG.position) { doc.x = CFG.position.x; doc.y = CFG.position.y; }
else if (others.length) { doc.x = Math.max(...others.map(n => n.x + n.width)) + 200; doc.y = Math.min(...others.map(n => n.y)); }
figma.viewport.scrollAndZoomIntoView([doc]);

return {
  frame: doc.id, page: page.id, blocks: blockIds, warnings,
  next: 'anatomy-annotate.js CFG → page: "' + page.id + '", exampleWidth: ' + CFG.exampleWidth + ', blocks: [' + blockIds.map(id => '{ block: "' + id + '" }').join(', ') + ']'
};
