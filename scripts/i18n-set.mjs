// Sets or adds strings in the locale files without hand-editing seven files.
//
//   node scripts/i18n-set.mjs changes.json
//
// changes.json maps a locale to dotted keys and their text:
//   { "en": { "recruit.full": "Roster full" }, "es": { "recruit.full": "Plantilla completa" }, ... }
// A key that exists has its value replaced; a missing key is added at the end of its block (missing blocks are created).
// Use null as the value to delete a key. Run `npm run format` and `npm test` afterwards (tests/i18n.test.js checks
// that every locale has the same keys and placeholders).
import fs from 'node:fs';

const quote = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

// Finds the line range of `key:` directly inside the block that starts at line `from` (its `{` line).
// Locale files are Prettier-formatted: two spaces per level, one key per line, blocks close with `},`.
function findKey(lines, from, depth, key) {
  const pad = ' '.repeat(depth * 2);
  for (let i = from + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith(pad.slice(2) + '}')) return { end: i }; // the block closed without the key
    if (!l.startsWith(pad + key + ':') && !l.startsWith(pad + `'${key}':`)) continue;
    // The value ends at the first line, at or after the key, that ends with `,` at this depth (or opens a block).
    if (/\{\s*$/.test(l)) return { start: i, block: true };
    let j = i;
    while (!/,\s*$/.test(lines[j])) j++;
    return { start: i, stop: j };
  }
  throw Error(`block at line ${from + 1} never closes`);
}

// Prettier keeps a short block on one line (`metrics: { a: 'A', b: 'B' },`). Before editing inside one, it is
// written out one key per line, splitting at the commas that sit outside quotes and inner braces.
function expandInline(lines, i) {
  {
    const m = /^(\s*)([\w$']+): \{(.+)\}(,?)$/.exec(lines[i]);
    if (!m) return false;
    const [, pad, key, body, comma] = m,
      parts = [];
    let depth = 0,
      quote = '',
      cur = '';
    for (let k = 0; k < body.length; k++) {
      const c = body[k];
      if (quote) {
        if (c === '\\') cur += c + body[++k];
        else {
          if (c === quote) quote = '';
          cur += c;
        }
        continue;
      }
      if (c === "'" || c === '"' || c === '`') quote = c;
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (c === ',' && !depth) {
        parts.push(cur.trim());
        cur = '';
      } else cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    lines.splice(i, 1, `${pad}${key}: {`, ...parts.map(p => `${pad}  ${p},`), `${pad}}${comma}`);
    return true;
  }
}

function apply(file, changes) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const root = lines.findIndex(l => l.startsWith('export default {'));
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split('.');
    let at = root;
    for (let d = 0; d < parts.length - 1; d++) {
      const f = findKey(lines, at, d + 1, parts[d]);
      if (f.start === undefined) {
        // A missing block is created empty at the end of its parent, then filled like any other.
        const pad = ' '.repeat((d + 1) * 2);
        lines.splice(f.end, 0, `${pad}${parts[d]}: {`, `${pad}},`);
        Object.assign(f, { start: f.end, block: true });
      }
      if (!f.block && expandInline(lines, f.start)) f.block = true;
      if (!f.block) throw Error(`${file}: ${parts.slice(0, d + 1).join('.')} is not a block`);
      at = f.start;
    }
    const depth = parts.length,
      leaf = parts.at(-1),
      f = findKey(lines, at, depth, leaf),
      key = /^[a-zA-Z_$][\w$]*$/.test(leaf) ? leaf : `'${leaf}'`,
      line = `${' '.repeat(depth * 2)}${key}: ${quote(value)},`;
    if (f.block) throw Error(`${file}: ${path} is a block, not a string`);
    if (value === null) {
      if (f.start !== undefined) lines.splice(f.start, f.stop - f.start + 1);
    } else if (f.start !== undefined) lines.splice(f.start, f.stop - f.start + 1, line);
    else lines.splice(f.end, 0, line);
  }
  fs.writeFileSync(file, lines.join('\n'));
}

const all = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [locale, changes] of Object.entries(all))
  apply(new URL(`../src/i18n/locales/${locale}.js`, import.meta.url), changes);
console.log(`Updated ${Object.keys(all).join(', ')}. Now run: npm run format && npm test`);
