#!/usr/bin/env node
/**
 * Promote a block from a sandbox to blocks/ and register it in component-definition.json
 *
 * Usage:
 *   node tools/blockify/approve.js <blockname> <sandbox-dir>
 *
 * Example:
 *   node tools/blockify/approve.js hero tools/sandbox/20260807-home
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toComponentDefinitionEntry } from './convert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const [,, blockName, sandboxDir] = process.argv;

if (!blockName || !sandboxDir) {
  console.error('Usage: node tools/blockify/approve.js <blockname> <sandbox-dir>');
  process.exit(1);
}

const sandboxBlock = path.join(REPO_ROOT, sandboxDir, 'blocks', blockName);
const targetBlock = path.join(REPO_ROOT, 'blocks', blockName);
const componentDefPath = path.join(REPO_ROOT, 'component-definition.json');

// Verify source exists
if (!fs.existsSync(sandboxBlock)) {
  console.error(`Error: sandbox block not found at ${sandboxBlock}`);
  process.exit(1);
}

// Check if target already has real (non-stub) code
if (fs.existsSync(targetBlock)) {
  const jsPath = path.join(targetBlock, `${blockName}.js`);
  if (fs.existsSync(jsPath)) {
    const content = fs.readFileSync(jsPath, 'utf8');
    const isStub = content.includes('// block-specific logic here') || content.length < 600;
    if (!isStub) {
      console.error(
        `blocks/${blockName}/ already contains real code.\n`
        + 'Remove it first or merge manually if you want to overwrite.',
      );
      process.exit(1);
    }
    console.log(`blocks/${blockName}/ exists but appears to be a stub — overwriting.`);
  }
}

// Copy sandbox block to blocks/
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcEntry = path.join(src, entry);
    const destEntry = path.join(dest, entry);
    if (fs.statSync(srcEntry).isDirectory()) {
      copyDir(srcEntry, destEntry);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

copyDir(sandboxBlock, targetBlock);
console.log(`Copied blocks/${blockName}/ from sandbox.`);

// Append to component-definition.json
if (!fs.existsSync(componentDefPath)) {
  console.warn('component-definition.json not found — skipping registration.');
} else {
  const def = JSON.parse(fs.readFileSync(componentDefPath, 'utf8'));
  const blocksGroup = def.groups.find((g) => g.id === 'blocks');

  if (!blocksGroup) {
    console.warn('No "blocks" group found in component-definition.json — skipping registration.');
  } else {
    const entry = toComponentDefinitionEntry(blockName);
    const existing = blocksGroup.components.find((c) => c.id === entry.id);

    if (existing) {
      console.log(`${blockName} already registered in component-definition.json — skipping.`);
    } else {
      blocksGroup.components.push(entry);
      blocksGroup.components.sort((a, b) => a.title.localeCompare(b.title));
      fs.writeFileSync(componentDefPath, JSON.stringify(def, null, 2) + '\n');
      console.log(`Registered ${blockName} in component-definition.json.`);
    }
  }
}

console.log(`\nDone. blocks/${blockName}/ is ready.`);
console.log(`Next steps:`);
console.log(`  1. Review blocks/${blockName}/${blockName}.js`);
console.log(`  2. Add real decoration logic`);
console.log(`  3. Run npm run lint:fix`);
console.log(`  4. Test at http://localhost:3000`);
