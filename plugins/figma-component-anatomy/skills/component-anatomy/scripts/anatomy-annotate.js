// anatomy-annotate.js — builds pink / blue anatomy annotations for the blocks of an anatomy frame.
// Usage: paste the whole file into the use_figma tool (Figma Plugin API) and edit only CFG. Rules and recipes: references/anatomy-guide.md.
// Idempotent: each Example is cleaned (everything except its title and the instance) and the Annotations layer is rebuilt.
// What it does: scales the instance, measures the elements of its rows, fills vertical paddings, draws dashed brackets for
// horizontal paddings and gaps, size arrows, blue text and icon sizes, checks the geometry, turns Specs row markers into
// coloured dots and adds the legend.
const CFG = {
  page: 'PAGE_ID',                                 // page that holds the anatomy frame
  blocks: [
    { block: 'BLOCK_ID' }                          // block frame: Example (left) + Specs (right); ids are returned by anatomy-page.js
    // Optional block fields (see references/anatomy-guide.md):
    //  title, create:{set,props,name}, props:{…}, width, focused, ring, ringX, scale, backdrop,
    //  boxOf(inst), rowOf(inst) | rowsOf(inst), classify(node,cur), ref, edges:{left,right}, zoneFilter(w,k),
    //  zoneRowOf(inst) — nodes of the row used for horizontal zones when it differs from rowsOf,
    //  bandFilter(zone) — keep only some vertical bands (zone: {nm:'top'|'gapN'|'bottom', y0, y1}),
    //  lanes:{…} — margins around the component for this block, exampleWidth — per-block override,
    //  vertical:'both'|'top'|'bottom'|'none', blue(item,rowIndex), kinds:{'Specs row name':'pink'|'blue'|'grey'}
    //  classify may return extra:[{kind:'text'|'icon', node, ptAbs?, font?|size?}] on an element — extra blue labels
    //  inside an "other" frame (a badge with text, a search bar with an icon); in blue(item) such items have item.owner.
  ],
  exampleWidth: 700,                               // Example width, the same for all blocks of the frame; 2× needs ≥ 2·W + 290
  lanes: { left: 80, top: 130, right: 210, bottom: 230 },
  scale: null,                                     // null: 2× if the component fits, otherwise 1×
  specs: true,                                     // recolour Specs row markers into dots
  font: 'Inter',                                   // pill and legend font; falls back to Inter
  legend: ['Pink — spacing and dimensions, px', 'Blue — text and icon sizes, px']
};

const PINK = { r: 0.91, g: 0.27, b: 0.49 }, BLUE = { r: 0.12, g: 0.42, b: 0.92 }, GREY = { r: 0.35, g: 0.38, b: 0.45 }, DOTGREY = { r: 0.6, g: 0.62, b: 0.68 }, W15 = 1.5;

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
function findAllNodes(root, pred, out = []) { if (pred(root)) out.push(root); if ('children' in root) for (const c of root.children) findAllNodes(c, pred, out); return out; }
function firstText(n) { if (n.type === 'TEXT' && n.visible) return n; if ('children' in n) for (const c of n.children) { if (c.visible === false) continue; const t = firstText(c); if (t) return t; } return null; }
const abs = n => n.absoluteBoundingBox;
const key = (i, n) => Object.keys(i.componentProperties).find(k => k.split('#')[0] === n);
function setProps(inst, props) {
  const m = {}; for (const [n, v] of Object.entries(props || {})) { const k = key(inst, n); if (!k) throw new Error('Property not found: ' + n); m[k] = v; }
  if (Object.keys(m).length) inst.setProperties(m);
}
async function preloadFonts(root) { for (const t of findAllNodes(root, n => n.type === 'TEXT')) for (const f of t.getRangeAllFontNames(0, Math.max(t.characters.length, 1))) await figma.loadFontAsync(f); }
function textWidth(t) {                                            // width of the string at the current font size (for full-width text boxes)
  const tmp = figma.createText(); tmp.fontName = t.getRangeFontName(0, 1); tmp.fontSize = t.fontSize; tmp.characters = t.characters; const w = tmp.width; tmp.remove(); return w;
}
function pointBox(t) {                                             // box of the actual glyphs (absolute coordinates)
  const b = abs(t); if (t.textAutoResize === 'WIDTH_AND_HEIGHT') return { x: b.x, y: b.y, width: b.width, height: b.height };
  const w = Math.min(b.width, textWidth(t)); let x = b.x; if (t.textAlignHorizontal === 'CENTER') x += (b.width - w) / 2; else if (t.textAlignHorizontal === 'RIGHT') x += b.width - w;
  return { x, y: b.y, width: w, height: b.height };
}

// element classification: text / icon (blue sizes), other (paddings only), [] — skip
const DEF = { text: /^((input|textarea) (text|label)|Content|Text|Label|Value|Suffix|Placeholder|Title|Caption)$/i, icon: /(Icon|Clear|Close|Arrow|Chevron|Check|Separator|Loader)/i, expand: /(Side|Group)$/i };
function classifyDefault(c, cur) {
  if (c.visible === false || c.layoutPositioning === 'ABSOLUTE') return [];
  if (DEF.expand.test(c.name) && 'children' in c) return c.children.flatMap(x => classifyDefault(x, cur));
  if (c.type === 'TEXT' || DEF.text.test(c.name)) {
    const t = firstText(c); if (!t) return [];
    const wrap = (c !== t && c.layoutSizingHorizontal === 'FILL');   // full-width text: the frame for zones, the glyphs for the pointer
    return [{ kind: 'text', node: wrap ? c : t, ptAbs: pointBox(t), font: Math.round(t.fontSize / cur) }];
  }
  if (DEF.icon.test(c.name)) return [{ kind: 'icon', node: c, size: Math.round(c.width / cur) }];
  return [{ kind: 'other', node: c }];
}

// ---------- dot colour in Specs ----------
function kindFor(name, token, value, over) {
  if (over && over[name]) return over[name];
  if (/^#[0-9a-f]{3,8}$/i.test((value || '').trim())) return 'grey';
  if (/^(Heading|Body|Label|Caption)\//i.test(token || '')) return 'blue';
  if (/(icon|label|caption|value|placeholder|text|font|typograph|loader|number|title|separator)/i.test(name)) return 'blue';
  if (/(color|colour|fill|background|glass)/i.test(name)) return 'grey';
  return 'pink';
}
async function recolorSpecs(block, over) {
  const specs = block.children.find(c => c.name === 'Specs'); if (!specs) return 0; let n = 0;
  const deep = (x, o = []) => { if (x.type === 'TEXT') o.push(x); if ('children' in x) for (const c of x.children) deep(c, o); return o; };
  for (const row of specs.children.filter(c => c.type === 'FRAME').slice(1)) {
    const ts = deep(row); const num = ts[0]; if (!num || !/^(\d+\.?|●)$/.test(num.characters.trim())) continue;
    const name = ts[1] ? ts[1].characters : '', value = ts[ts.length - 1].characters, token = ts.length >= 4 ? ts[2].characters : '';
    const k = kindFor(name, token, value, over);
    for (const f of num.getRangeAllFontNames(0, num.characters.length)) await figma.loadFontAsync(f);
    num.characters = '●'; num.fills = [{ type: 'SOLID', color: k === 'blue' ? BLUE : (k === 'grey' ? DOTGREY : PINK) }]; n++;
  }
  return n;
}

// ---------- main pass ----------
const page = await figma.getNodeByIdAsync(CFG.page); if (!page || page.type !== 'PAGE') throw new Error('CFG.page is not a page id');
await figma.setCurrentPageAsync(page);
const F = await resolveFonts(CFG.font);

const results = [];
for (const B of CFG.blocks) {
  const block = await figma.getNodeByIdAsync(B.block); if (!block) throw new Error('Block not found: ' + B.block);
  const ex = block.children.find(c => c.name === 'Example'); if (!ex) throw new Error('Block ' + B.block + ' has no Example frame');
  const exW = B.exampleWidth || CFG.exampleWidth; const L = Object.assign({}, CFG.lanes, B.lanes || {});
  const title = ex.children.find(c => c.type === 'TEXT');
  let inst = ex.children.find(c => c.type === 'INSTANCE');
  if (B.create) {
    if (inst) inst.remove();
    const src = await figma.getNodeByIdAsync(B.create.set);
    if (src && src.type === 'COMPONENT_SET') inst = src.defaultVariant.createInstance();
    else if (src && src.type === 'COMPONENT') inst = src.createInstance();
    else throw new Error('create.set must be a component set or component id');
    ex.appendChild(inst); setProps(inst, B.create.props); inst.name = B.create.name || (src.type === 'COMPONENT_SET' ? src.name : (src.parent.type === 'COMPONENT_SET' ? src.parent.name : src.name));
  }
  if (!inst) throw new Error('Example has no instance: set create');
  if (B.title && title) { await figma.loadFontAsync(title.fontName); title.characters = B.title; }
  for (const c of [...ex.children]) if (c !== title && c !== inst) c.remove();

  // ---- scale: the current one is read from the name suffix "… @2x"; properties and width are changed at 1×
  let mm = inst.name.match(/@([\d.]+)x$/); let cur = mm ? parseFloat(mm[1]) : 1;
  if ((B.props || B.width) && cur !== 1) { inst.rescale(1 / cur); cur = 1; inst.name = inst.name.replace(/\s*@[\d.]+x$/, ''); }
  if (B.props) setProps(inst, B.props);
  if (B.width) inst.resize(B.width, inst.height);
  await preloadFonts(inst);
  const boxOf = B.boxOf || (i => i);
  const box = boxOf(inst); if (!box) throw new Error('boxOf returned nothing');
  const room = exW - L.left - L.right; const boxW1 = abs(box).width / cur;
  const S = B.scale || CFG.scale || (boxW1 * 2 <= room ? 2 : 1);
  if (boxW1 * S > room) throw new Error('Component (' + Math.round(boxW1 * S) + ' px) does not fit into ' + room + ' px: increase exampleWidth');
  if (Math.abs(S / cur - 1) > 1e-6) inst.rescale(S / cur);
  inst.name = inst.name.replace(/\s*@[\d.]+x$/, '') + ' @' + S + 'x'; cur = S;

  // ---- position: the reference box is centred in the working area
  const bb0 = abs(box), ib0 = abs(inst); const bw = bb0.width, bh = bb0.height;
  const bx = L.left + Math.floor((room - bw) / 2), by = L.top;
  inst.x = bx - (bb0.x - ib0.x); inst.y = by - (bb0.y - ib0.y);
  ex.resize(exW, L.top + bh + L.bottom);

  // ---- measurements in px at 1×: rows of elements
  const bb = abs(box);
  const rel = n => { const b = abs(n); return { x0: (b.x - bb.x) / cur, x1: (b.x - bb.x + b.width) / cur, y0: (b.y - bb.y) / cur, y1: (b.y - bb.y + b.height) / cur }; };
  const relAbs = b => ({ x0: (b.x - bb.x) / cur, x1: (b.x - bb.x + b.width) / cur, y0: (b.y - bb.y) / cur, y1: (b.y - bb.y + b.height) / cur });
  const classify = B.classify || classifyDefault;
  const rowNodes = B.rowsOf ? B.rowsOf(inst) : [(B.rowOf || (i => i.children[0]))(inst).children];
  const rows = [];
  for (const nodes of rowNodes) {
    const items = nodes.flatMap(c => classify(c, cur)); if (!items.length) continue;
    for (const it of items) { it.box = rel(it.node); it.pt = it.ptAbs ? relAbs(it.ptAbs) : it.box; for (const e of (it.extra || [])) { e.owner = it.node; e.box = rel(e.node); e.pt = e.ptAbs ? relAbs(e.ptAbs) : e.box; } }
    items.sort((a, b) => a.box.x0 - b.box.x0);
    rows.push({ items, y0: Math.min(...items.map(i => i.box.y0)), y1: Math.max(...items.map(i => i.box.y1)), x0: Math.min(...items.map(i => i.box.x0)), x1: Math.max(...items.map(i => i.box.x1)) });
  }
  if (!rows.length) throw new Error('No visible elements: check rowOf / rowsOf / classify');
  rows.sort((a, b) => a.y0 - b.y0);
  const W = bb.width / cur, H = bb.height / cur;
  let refIdx = B.ref; if (refIdx === undefined) { refIdx = 0; rows.forEach((r, i) => { if (r.x1 - r.x0 > rows[refIdx].x1 - rows[refIdx].x0 + 0.5) refIdx = i; }); }
  let ref = rows[refIdx];
  if (B.zoneRowOf) { const zn = B.zoneRowOf(inst).filter(Boolean).flatMap(c => classify(c, cur)); for (const it of zn) { it.box = rel(it.node); it.pt = it.ptAbs ? relAbs(it.ptAbs) : it.box; } zn.sort((a, b) => a.box.x0 - b.box.x0); ref = { items: zn, y0: Math.min(...zn.map(i => i.box.y0)), y1: Math.max(...zn.map(i => i.box.y1)) }; }
  const yc = (ref.y0 + ref.y1) / 2;
  const X = v => bx + v * S, Y = v => by + v * S;
  let rad = box.cornerRadius; if (rad === figma.mixed || !rad) rad = inst.cornerRadius; if (rad === figma.mixed || !rad) rad = 0; rad = Math.min(rad, bh / 2);

  // ---- layers
  const layer = figma.createFrame(); layer.name = 'Annotations'; layer.fills = []; layer.clipsContent = false; layer.resize(ex.width, ex.height); ex.appendChild(layer); layer.x = 0; layer.y = 0;
  const mkLayer = name => { const f = figma.createFrame(); f.name = name; f.fills = []; f.clipsContent = false; f.resize(ex.width, ex.height); layer.appendChild(f); f.x = 0; f.y = 0; return f; };
  const pinkL = mkLayer('Pink · spacing and dimensions'), blueL = mkLayer('Blue · text and icons');
  if (B.backdrop) {                                                         // dark (or custom) surface under the component
    const bd = B.backdrop === true ? {} : B.backdrop; const pad = bd.pad === undefined ? 16 : bd.pad;
    const r = figma.createRectangle(); r.name = 'Surface'; r.resize(bw + 2 * pad, bh + 2 * pad); r.x = bx - pad; r.y = by - pad; r.cornerRadius = bd.radius === undefined ? 12 : bd.radius;
    r.fills = [{ type: 'SOLID', color: bd.fill || { r: 0.1, g: 0.1, b: 0.1 } }]; ex.insertChild(ex.children.indexOf(inst), r);
  }
  const prims = []; const addPrim = (g, x0, y0, x1, y1, kind, n) => prims.push({ g, x0, y0, x1, y1, kind, n });
  const line = (g, x0, y0, x1, y1, col, parent, name) => {
    const horiz = Math.abs(y1 - y0) < 0.01; const r = figma.createRectangle(); r.name = name; r.fills = [{ type: 'SOLID', color: col }];
    if (horiz) { r.resize(Math.max(Math.abs(x1 - x0), 0.5), W15); r.x = Math.min(x0, x1); r.y = y0 - W15 / 2; addPrim(g, r.x, r.y, r.x + r.width, r.y + W15, 'line', name); }
    else { r.resize(W15, Math.max(Math.abs(y1 - y0), 0.5)); r.x = x0 - W15 / 2; r.y = Math.min(y0, y1); addPrim(g, r.x, r.y, r.x + W15, r.y + r.height, 'line', name); }
    parent.appendChild(r); return r;
  };
  const bracket = (g, x, y, w, h, name) => {                                // dashed bracket: top and both sides, open bottom, no fill
    const r = figma.createRectangle(); r.name = name; r.resize(w, h); r.x = x; r.y = y; r.fills = []; r.strokes = [{ type: 'SOLID', color: PINK }];
    r.strokeTopWeight = W15; r.strokeLeftWeight = W15; r.strokeRightWeight = W15; r.strokeBottomWeight = 0; r.dashPattern = [4, 3]; pinkL.appendChild(r);
    addPrim(g, x, y, x + w, y + W15, 'line', name + ' top'); addPrim(g, x, y, x + W15, y + h, 'line', name + ' left'); addPrim(g, x + w - W15, y, x + w, y + h, 'line', name + ' right'); return r;
  };
  const mkText = (s, size, font, col) => { const t = figma.createText(); t.fontName = font; t.fontSize = size; t.characters = s; t.fills = [{ type: 'SOLID', color: col }]; return t; };
  const pill = (g, txt, col, cx, cy, parent) => {
    const f = autoFrame('HORIZONTAL', 'Pill ' + txt, 0); f.paddingLeft = 9; f.paddingRight = 9; f.paddingTop = 4; f.paddingBottom = 4; f.cornerRadius = 100;
    f.fills = [{ type: 'SOLID', color: col }]; f.primaryAxisAlignItems = 'CENTER'; f.counterAxisAlignItems = 'CENTER';
    f.appendChild(mkText(txt, 13, F.bold, { r: 1, g: 1, b: 1 })); parent.appendChild(f); f.x = Math.round(cx - f.width / 2); f.y = Math.round(cy - f.height / 2);
    addPrim(g, f.x, f.y, f.x + f.width, f.y + f.height, 'pill', 'Pill ' + txt); return f;
  };
  const movePill = (f, y) => { f.y = Math.round(y - f.height / 2); const p = prims[prims.length - 1]; p.y0 = f.y; p.y1 = f.y + f.height; };

  // ---- vertical zones: top and bottom paddings (per the vertical mode) and gaps between rows
  const vMode = B.vertical || 'both'; let vz = [];
  if ((vMode === 'both' || vMode === 'top') && rows[0].y0 >= 1) vz.push({ y0: 0, y1: rows[0].y0, nm: 'top' });
  for (let i = 0; i < rows.length - 1; i++) if (rows[i + 1].y0 - rows[i].y1 >= 1) vz.push({ y0: rows[i].y1, y1: rows[i + 1].y0, nm: 'gap' + i });
  const lastRow = rows[rows.length - 1]; if ((vMode === 'both' || vMode === 'bottom') && H - lastRow.y1 >= 1) vz.push({ y0: lastRow.y1, y1: H, nm: 'bottom' });
  if (B.bandFilter) vz = vz.filter(B.bandFilter);
  const fills = figma.createFrame(); fills.name = 'Band fills (clipped to component)'; fills.fills = []; fills.clipsContent = true; fills.cornerRadius = rad; fills.resize(bw, bh); pinkL.appendChild(fills); fills.x = bx; fills.y = by;
  for (const z of vz) { const r = figma.createRectangle(); r.name = 'Band ' + Math.round(z.y1 - z.y0); r.resize(bw, Math.max((z.y1 - z.y0) * S, 0.5)); r.x = 0; r.y = z.y0 * S; r.fills = [{ type: 'SOLID', color: PINK, opacity: 0.2 }]; fills.appendChild(r); }

  // ---- horizontal zones (left, right, gaps) along the reference row: dashed brackets from the lane above down to the row centre
  const xs = [0, ...ref.items.flatMap(i => [i.box.x0, i.box.x1]), W]; const edges = Object.assign({ left: true, right: true }, B.edges || {});
  const placed = []; const zones = []; let zi = 0;
  for (let k = 0; k < xs.length; k += 2) {
    const a = xs[k], b = xs[k + 1]; const w1 = Math.round(b - a); if (w1 <= 0) continue;
    if (k === 0 && !edges.left) continue; if (k === xs.length - 2 && !edges.right) continue; if (B.zoneFilter && !B.zoneFilter(w1, k / 2)) continue;
    const g = 'hz:' + (zi++) + ':' + w1; zones.push(w1);
    bracket(g, X(a), by - 34, (b - a) * S, 34 + yc * S, 'Bracket ' + w1);
    const cx = X((a + b) / 2); const pl = pill(g, String(w1), PINK, cx, by - 52, pinkL); const last = placed[placed.length - 1];
    if (last && pl.x - last < 5) { movePill(pl, by - 52 - 30); line(g, cx, pl.y + pl.height, cx, by - 34, PINK, pinkL, 'Connector ' + w1); }   // crowded pills: second level
    placed.push(pl.x + pl.width);
  }

  // ---- vertical zones: solid bracket outside on the right and a pill
  const xb = bx + bw + 14; let maxPill = 0; const vals = [];
  for (const z of vz) {
    const val = Math.round(z.y1 - z.y0); vals.push(val); const g = 'vb:' + z.nm; const y0 = Y(z.y0), y1 = Y(z.y1);
    line(g, xb, y0, xb, y1, PINK, pinkL, 'Bracket ' + z.nm); line(g, xb - 8, y0, xb, y0, PINK, pinkL, 'Tick'); line(g, xb - 8, y1, xb, y1, PINK, pinkL, 'Tick');
    const pl = pill(g, String(val), PINK, xb + 12 + 20, (y0 + y1) / 2, pinkL); pl.x = xb + 12; const p = prims[prims.length - 1]; p.x0 = pl.x; p.x1 = pl.x + pl.width; maxPill = Math.max(maxPill, pl.width);
  }

  // ---- height (right) and width (bottom): the line breaks around the pill
  const ax = xb + 12 + Math.max(maxPill, 30) + 44;
  { const g = 'ha'; const pl = pill(g, String(Math.round(H)), PINK, ax, by + bh / 2, pinkL);
    line(g, ax, by, ax, pl.y - 3, PINK, pinkL, 'Height line'); line(g, ax, pl.y + pl.height + 3, ax, by + bh, PINK, pinkL, 'Height line');
    line(g, ax - 8, by, ax + 8, by, PINK, pinkL, 'Tick'); line(g, ax - 8, by + bh, ax + 8, by + bh, PINK, pinkL, 'Tick'); }
  const wy = by + bh + 120;
  { const g = 'wa'; const pl = pill(g, String(Math.round(W)), PINK, bx + bw / 2, wy, pinkL);
    line(g, bx, wy, pl.x - 3, wy, PINK, pinkL, 'Width line'); line(g, pl.x + pl.width + 3, wy, bx + bw, wy, PINK, pinkL, 'Width line');
    line(g, bx, wy - 8, bx, wy + 8, PINK, pinkL, 'Tick'); line(g, bx + bw, wy - 8, bx + bw, wy + 8, PINK, pinkL, 'Tick'); }

  // ---- blue text and icon sizes: rows above the reference row go up, the last row goes down, others get no blue labels
  let bi = 0;
  rows.forEach((row, ri) => {
    const side = ri < refIdx ? 'top' : (ri === rows.length - 1 ? 'bottom' : null); if (!side) return; let lastBlue = null;
    for (const it of row.items.flatMap(x => [x, ...(x.extra || [])])) {
      if (it.kind !== 'text' && it.kind !== 'icon') continue; if (B.blue && !B.blue(it, ri)) continue; const g = 'bl:' + (bi++);
      const cx = X((it.pt.x0 + it.pt.x1) / 2); const label = (it.kind === 'text' ? it.font : it.size) + ' px';
      if (side === 'bottom') {
        const ey = Y(it.pt.y1) - 2; let py = by + bh + 46; const pl = pill(g, label, BLUE, cx, py, blueL);
        if (lastBlue !== null && pl.x - lastBlue < 5) { py += 34; movePill(pl, py); } lastBlue = pl.x + pl.width;
        line(g, cx, ey, cx, pl.y, BLUE, blueL, 'Leader');
        const e = figma.createEllipse(); e.name = 'Dot'; e.resize(9, 9); e.x = cx - 4.5; e.y = ey - 4.5; e.fills = [{ type: 'SOLID', color: BLUE }]; blueL.appendChild(e); addPrim(g, cx - 4.5, ey - 4.5, cx + 4.5, ey + 4.5, 'dot', 'Dot');
      } else {
        const ey = Y(it.pt.y0) + 2; let py = by - 92; const pl = pill(g, label, BLUE, cx, py, blueL);
        if (lastBlue !== null && pl.x - lastBlue < 5) { py -= 34; movePill(pl, py); } lastBlue = pl.x + pl.width;
        line(g, cx, pl.y + pl.height, cx, ey, BLUE, blueL, 'Leader');
        const e = figma.createEllipse(); e.name = 'Dot'; e.resize(9, 9); e.x = cx - 4.5; e.y = ey - 4.5; e.fills = [{ type: 'SOLID', color: BLUE }]; blueL.appendChild(e); addPrim(g, cx - 4.5, ey - 4.5, cx + 4.5, ey + 4.5, 'dot', 'Dot');
      }
    }
  });

  // ---- focus ring: translucent ring over the stroke area and a pill with a leader below
  if (B.focused) {
    const t = (B.ring || 2) * S;
    const ring = figma.createRectangle(); ring.name = 'Ring zone'; ring.resize(bw + 2 * t, bh + 2 * t); ring.x = bx - t; ring.y = by - t; ring.cornerRadius = rad + t; ring.fills = [];
    ring.strokes = [{ type: 'SOLID', color: PINK, opacity: 0.4 }]; ring.strokeWeight = t; ring.strokeAlign = 'INSIDE'; pinkL.insertChild(1, ring);
    const off = Math.min(Math.max(rad > 0 ? rad : 20, 40), bw * 0.3), dx = Math.max(rad - off, 0);
    const yb = by + bh - rad + Math.sqrt((rad + t) * (rad + t) - dx * dx); const rx = bx + (B.ringX !== undefined ? B.ringX : off); const g = 'ring';
    const pl = pill(g, String(B.ring || 2), PINK, rx, by + bh + 84, pinkL); line(g, rx, yb + 1, rx, pl.y, PINK, pinkL, 'Ring leader');
  }

  // ---- geometry check: lines of different labels never touch or cross (≥ 1 px), pills keep ≥ 3 px
  const conflicts = [];
  for (let i = 0; i < prims.length; i++) for (let j = i + 1; j < prims.length; j++) {
    const a = prims[i], b = prims[j]; if (a.g === b.g) continue; const m = (a.kind === 'pill' && b.kind === 'pill') ? 3 : 1;
    if (a.x0 - m < b.x1 && a.x1 + m > b.x0 && a.y0 - m < b.y1 && a.y1 + m > b.y0) conflicts.push(a.g + ' × ' + b.g + ' (' + a.n + ' / ' + b.n + ')');
  }
  title && (title.x = 16, title.y = 14);
  const dots = CFG.specs === false ? 0 : await recolorSpecs(block, B.kinds);
  results.push({ block: B.block, scale: S, example: Math.round(ex.width) + 'x' + Math.round(ex.height), rows: rows.map(r => r.items.map(i => i.kind + ' ' + Math.round(i.box.x0) + '–' + Math.round(i.box.x1)).join(', ')), ref: refIdx, zones, vertical: vals, dots, conflicts });
}

// ---- legend after the "Structure …" title and anatomy frame width (Example + gap 32 + Specs 736 + paddings 192)
const first = await figma.getNodeByIdAsync(CFG.blocks[0].block); const content = first.parent;
if (content && content.name === 'Content') {
  if (!content.children.some(c => c.name === 'Legend')) {
    const leg = autoFrame('HORIZONTAL', 'Legend', 20); leg.counterAxisAlignItems = 'CENTER';
    const item = (col, txt) => {
      const g = autoFrame('HORIZONTAL', 'Legend item', 8); g.counterAxisAlignItems = 'CENTER';
      const d = figma.createEllipse(); d.resize(10, 10); d.fills = [{ type: 'SOLID', color: col }]; g.appendChild(d);
      const t = figma.createText(); t.fontName = F.regular; t.fontSize = 13; t.characters = txt; t.fills = [{ type: 'SOLID', color: GREY }]; g.appendChild(t); return g;
    };
    leg.appendChild(item(PINK, CFG.legend[0])); leg.appendChild(item(BLUE, CFG.legend[1]));
    const ti = content.children.findIndex(c => c.type === 'TEXT' && /^Structure/i.test(c.characters)); content.insertChild(ti >= 0 ? ti + 1 : 1, leg);
  }
  const anat = content.parent; const need = CFG.exampleWidth + 960;
  if (anat && anat.type === 'FRAME') { if (anat.width < need) { anat.resize(need, anat.height); anat.primaryAxisSizingMode = 'AUTO'; } const h = anat.children[0]; try { h.layoutSizingHorizontal = 'FILL'; } catch (e) { } }
}
return results;
