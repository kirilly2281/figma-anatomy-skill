// anatomy-specs.js — fills the Specs table of one anatomy block: coloured dot · name · token · value.
// Usage: paste the whole file into the use_figma tool (Figma Plugin API) and edit only CFG. Process: references/anatomy-guide.md.
// Dot: pink — paddings and dimensions, blue — text and icon sizes, grey — colour values (colours are not annotated on the example).
// The table needs a template row with a token chip (built by anatomy-page.js). If the block's Specs has none,
// set templateFrom to the id of another block with a standard Specs: its table is cloned (from any page) and replaces this one.
const CFG = {
  page: 'PAGE_ID',                                 // page that holds the anatomy frame
  block: 'BLOCK_ID',                               // block frame (Example + Specs)
  templateFrom: null,                              // block id to copy a standard Specs table from
  rows: [
    { name: 'Height', token: 'button/height/md', value: '40', kind: 'pink' },
    { name: 'Padding left / right', token: 'spacing/16', value: '16', kind: 'pink' },
    { name: 'Gap', token: 'spacing/8', value: '8', kind: 'pink' },
    { name: 'Label', token: 'Label/Medium', value: '16 / 24', kind: 'blue' },
    { name: 'Icon', token: 'icon/size/md', value: '20', kind: 'blue' },
    { name: 'Background', token: 'color/primary/default', value: '#1F6BEB', kind: 'grey' }
    // token: '—' or empty — no token (a grey dash instead of the chip)
    // several modes in one value: '20 / 16 / 12' (Desktop / Tablet / Mobile)
  ],
  note: null                                       // string — replace the note under the table; '' — remove it; null — keep
};

const DOT = { pink: { r: 0.91, g: 0.27, b: 0.49 }, blue: { r: 0.12, g: 0.42, b: 0.92 }, grey: { r: 0.6, g: 0.62, b: 0.68 } };
const GREY = { r: 0.35, g: 0.38, b: 0.45 };

const page = await figma.getNodeByIdAsync(CFG.page); if (!page || page.type !== 'PAGE') throw new Error('CFG.page is not a page id');
await figma.setCurrentPageAsync(page);
const block = await figma.getNodeByIdAsync(CFG.block); if (!block) throw new Error('Block not found: ' + CFG.block);
let specs = block.children.find(c => c.name === 'Specs');
if (!specs) throw new Error('Block has no Specs frame');
const deepText = (n, o = []) => { if (n.type === 'TEXT') o.push(n); if ('children' in n) for (const c of n.children) deepText(c, o); return o; };
const setText = async (t, s) => { for (const f of t.getRangeAllFontNames(0, Math.max(t.characters.length, 1))) await figma.loadFontAsync(f); t.characters = s; };
const isChip = c => c.type === 'INSTANCE' || /chip/i.test(c.name);
const findTpl = sp => sp.children.filter(c => c.type === 'FRAME').slice(1).find(r => r.children.length === 4 && 'children' in r.children[2] && r.children[2].children.some(isChip));

if (!findTpl(specs)) {
  if (!CFG.templateFrom) throw new Error('Specs has no template row with a token chip: set templateFrom');
  const srcBlock = await figma.getNodeByIdAsync(CFG.templateFrom); const src = srcBlock && srcBlock.children.find(c => c.name === 'Specs');
  if (!src) throw new Error('templateFrom block has no Specs');
  const clone = src.clone(); const idx = block.children.indexOf(specs);
  block.insertChild(idx, clone); specs.remove(); specs = clone;
  try { specs.layoutSizingHorizontal = 'FILL'; } catch (e) { }
}

const frames = specs.children.filter(c => c.type === 'FRAME'); const dataRows = frames.slice(1);          // frames[0] — the Name / Token / Value header
const tpl = findTpl(specs);
if (!tpl) throw new Error('No template row with a token chip');
const baseFont = tpl.children[1].fontName !== figma.mixed ? tpl.children[1].fontName : { family: 'Inter', style: 'Regular' };
await figma.loadFontAsync(baseFont);

let idx = specs.children.indexOf(frames[0]) + 1;
for (const r of CFG.rows) {
  const row = tpl.clone(); specs.insertChild(idx++, row);
  const [dot, nm, tc, val] = row.children;
  await setText(dot, '●'); dot.fills = [{ type: 'SOLID', color: DOT[r.kind || 'pink'] }];
  await setText(nm, r.name);
  const chip = tc.children.find(isChip);
  if (!r.token || r.token === '—') {
    if (chip) chip.remove();
    const t = figma.createText(); t.fontName = baseFont; t.fontSize = 12; t.characters = '—'; t.fills = [{ type: 'SOLID', color: GREY }]; tc.appendChild(t);
  } else {
    await setText(deepText(chip)[0], r.token);
  }
  await setText(val, String(r.value));
}
for (const r of dataRows) r.remove();                                                                    // previous rows, including the template

if (CFG.note !== null) {
  const noteNode = specs.children.find(c => c.type === 'TEXT');
  if (CFG.note === '') { if (noteNode) noteNode.remove(); }
  else if (noteNode) await setText(noteNode, CFG.note);
  else { const t = figma.createText(); t.fontName = baseFont; t.fontSize = 12; t.characters = CFG.note; t.fills = [{ type: 'SOLID', color: GREY }]; specs.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; }
}
return specs.children.filter(c => c.type === 'FRAME').slice(1).map(r => deepText(r).map(t => t.characters).join(' | '));
