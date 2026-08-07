# blockify — AEM-to-EDS page converter

Convert an AEM Publish page (URL, pasted HTML, or local file) into EDS blocks and generate
sandbox files ready for local testing.

## Usage

```
/blockify <url>
/blockify <path/to/file.html>
/blockify   (then paste HTML when prompted)
```

## What this skill does

1. **Fetch / read** the source HTML
2. **Analyze** it using `tools/blockify/convert.js` — classify AEM components into EDS blocks
3. **Dry-run output** — print the classification table and block HTML previews
4. **Confirm** — wait for the user to say "go", "yes", "run it", or similar
5. **Write sandbox files** to `tools/sandbox/YYYYMMDD-<slug>/`
6. **Show approve commands** for promoting individual blocks

---

## Step-by-step workflow

### Step 1 — Get the HTML

- If a **URL** was provided: `fetch` it. If CORS blocks the request, say so clearly and ask
  the user to paste the HTML source instead.
- If a **file path** was provided: read it with the Read tool.
- If nothing was provided: ask the user to paste HTML, then proceed.

### Step 2 — Run analyzeHTML via Node

Run the conversion inline using Node:

```bash
node --input-type=module <<'EOF'
import { analyzeHTML } from '/Users/pstolmar/dev/eds/diagram-editor/tools/blockify/convert.js';

const html = `PASTE_OR_LOAD_HTML_HERE`;
const analysis = await analyzeHTML(html, 'SOURCE_URL_HERE');

console.log('=== Classification Table ===');
console.log(JSON.stringify(analysis.classificationTable, null, 2));
console.log('\n=== Sections ===');
analysis.sections.forEach(s => {
  console.log(`--- Section ${s.index + 1} | ${s.classification.blockName || 'plain'} (${Math.round(s.classification.confidence * 100)}%) ---`);
  console.log(s.blockHtml.substring(0, 300));
  console.log();
});
EOF
```

> Note: if the HTML is very large, write it to a temp file first and read it with `fs.readFileSync`.

### Step 3 — Dry-run output to user

Present a table:

```
| # | AEM Components      | Detected Pattern | EDS Block  | Confidence |
|---|---------------------|-----------------|------------|------------|
| 1 | Title, Image, Text  | image+title+text | hero       | 95%        |
| 2 | Title               | plain heading   | (plain)    | 90%        |
| 3 | Teaser              | teaser component | teaser     | 95%        |
```

Show HTML snippet for each classified block (first 8 lines).

Then ask: **"Ready to generate sandbox files? (yes/no)"**

### Step 4 — Write sandbox files (on confirmation)

Calculate the sandbox path:
```
tools/sandbox/YYYYMMDD-<slug>/
```

Where `YYYYMMDD` = today's date, `<slug>` = last path segment of URL (no `.html`).

Write these files:

**`tools/sandbox/YYYYMMDD-<slug>/index.html`** — full EDS page

Run node to generate it:
```bash
node --input-type=module <<'EOF'
import { analyzeHTML, toEDSPage } from '/Users/pstolmar/dev/eds/diagram-editor/tools/blockify/convert.js';
import { writeFileSync, mkdirSync } from 'fs';

const html = `HTML_HERE`;
const analysis = await analyzeHTML(html, 'URL_HERE');
const edsHtml = toEDSPage(analysis);

const dir = 'tools/sandbox/YYYYMMDD-SLUG';
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/index.html`, edsHtml);
console.log('wrote', dir + '/index.html');
EOF
```

**`tools/sandbox/YYYYMMDD-<slug>/blocks/<blockname>/<blockname>.js`** — stub JS
**`tools/sandbox/YYYYMMDD-<slug>/blocks/<blockname>/<blockname>.css`** — stub CSS

For each unique block name in `analysis.sections` where `blockName !== null`:

```bash
node --input-type=module <<'EOF'
import { toBlockStub } from '/Users/pstolmar/dev/eds/diagram-editor/tools/blockify/convert.js';
import { writeFileSync, mkdirSync } from 'fs';

const blockName = 'BLOCK_NAME';
const { js, css } = toBlockStub(blockName);
const dir = `tools/sandbox/YYYYMMDD-SLUG/blocks/${blockName}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/${blockName}.js`, js);
writeFileSync(`${dir}/${blockName}.css`, css);
console.log('wrote stubs for', blockName);
EOF
```

### Step 5 — Show approve commands

After writing all files, show:

```
Sandbox written to: tools/sandbox/YYYYMMDD-<slug>/

To promote a block to the main blocks/ directory:
  approve hero
  approve teaser
  ...

Run: /blockify-approve <blockname> <sandbox-path>
```

---

## approve sub-command

When the user says `approve <blockname>` or runs `/blockify` with an approve flag:

1. Copy `tools/sandbox/YYYYMMDD-<slug>/blocks/<blockname>/` → `blocks/<blockname>/`
   (skip if `blocks/<blockname>/` already exists and has real code — ask to confirm overwrite)

2. Append to `component-definition.json` (into `groups[2].components`):

```bash
node --input-type=module <<'EOF'
import { readFileSync, writeFileSync } from 'fs';
import { toComponentDefinitionEntry } from '/Users/pstolmar/dev/eds/diagram-editor/tools/blockify/convert.js';

const path = 'component-definition.json';
const def = JSON.parse(readFileSync(path, 'utf8'));
const entry = toComponentDefinitionEntry('BLOCK_NAME');

// Avoid duplicates
const blocks = def.groups[2].components;
if (!blocks.find(b => b.id === entry.id)) {
  blocks.push(entry);
  blocks.sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(path, JSON.stringify(def, null, 2));
  console.log('added', entry.id, 'to component-definition.json');
} else {
  console.log(entry.id, 'already exists');
}
EOF
```

3. Report what was done.

---

## Error handling

- **CORS failure on fetch**: report clearly, ask user to paste source HTML from browser DevTools (Cmd+U or view-source:)
- **No AEM sections found**: report that the HTML may not be an AEM Core Components page; show the body structure
- **Empty analysis**: warn and show the raw HTML structure so the user can inspect
- **File not found**: report the path and ask for the correct location

---

## Important constraints

- Never push to git automatically — only write files and report
- If `blocks/<blockname>/` already exists with real code (non-stub), ask before overwriting
- The sandbox is always under `tools/sandbox/` — never write directly to `blocks/` without explicit approve
- All Node invocations use `--input-type=module` for ESM compatibility
