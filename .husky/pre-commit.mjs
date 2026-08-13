import { exec } from "node:child_process";
import fs from "node:fs";

const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  }
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// Rebuild aggregated model JSON when any partial _*.json model files are staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

// Always run lint — catches JS/CSS errors and xwalk rule violations before they reach CI
const jsOrCssChanged = modifiedFiles.some(
  (f) => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.css') || f.endsWith('.json'),
);
if (jsOrCssChanged) {
  console.log('🔍 Running lint...');
  try {
    await run('npm run lint');
    console.log('✅ Lint passed.');
  } catch (err) {
    console.error('❌ Lint FAILED — fix errors before committing.\n');
    console.error(err.message || err);
    process.exit(1);
  }
}

// Guard: reject any staged vault package that uses a directory-level filter on
// config.author — those wipe ALL OSGi configs in that dir, breaking Universal Editor.
const stagedZips = modifiedFiles.filter((f) => f.endsWith('.zip'));
if (stagedZips.length > 0) {
  const checkScript = `
import zipfile, sys, re
bad = []
for path in ${JSON.stringify(stagedZips)}:
    try:
        with zipfile.ZipFile(path) as z:
            try:
                fxml = z.read('META-INF/vault/filter.xml').decode()
                # Dangerous pattern: filter root ending at config.author itself (no filename after)
                if re.search(r'root="[^"]*config\\.author"', fxml):
                    bad.append(path)
            except KeyError:
                pass
    except Exception:
        pass
if bad:
    print('BLOCKED: ' + ', '.join(bad))
    sys.exit(1)
`;
  try {
    await run(`python3 -c '${checkScript.replace(/'/g, "'\\''")}'`);
  } catch (err) {
    const blocked = (err.message || '').match(/BLOCKED: (.+)/)?.[1] || stagedZips.join(', ');
    console.error(`\n🚫 COMMIT BLOCKED — package(s) with directory-level config.author filter detected:\n   ${blocked}`);
    console.error('   A filter like root="/apps/.../config.author" wipes ALL OSGi configs in that');
    console.error('   directory on install, breaking Universal Editor. Use a file-level filter:');
    console.error('   root="/apps/.../config.author/com.example.MyConfig~name.cfg.json"\n');
    process.exit(1);
  }
}

// Run critical-path Playwright tests when any blocks/ files change.
// Only runs if the dev server is already up (curl check) — avoids blocking
// committers who aren't running the dev server locally.
const blocksChanged = modifiedFiles.some((f) => f.startsWith('blocks/'));
if (blocksChanged && fs.existsSync('tests/critical-path.json')) {
  const criticalSpecs = JSON.parse(fs.readFileSync('tests/critical-path.json', 'utf8'));
  if (criticalSpecs.length > 0) {
    // Check if dev server is up before attempting Playwright
    let serverUp = false;
    try {
      await run('curl -sL --max-time 3 -o /dev/null http://localhost:3000');
      serverUp = true;
    } catch {
      // Server not running — skip tests with a warning
    }

    if (!serverUp) {
      console.log('⚠️  critical-path tests skipped (dev server not running at localhost:3000)');
    } else {
      console.log(`🧪 Running ${criticalSpecs.length} critical-path Playwright tests...`);
      try {
        const result = await run(
          `npx playwright test ${criticalSpecs.join(' ')} --reporter=list`
        );
        console.log(result);
        console.log('✅ Critical-path tests passed.');
      } catch (err) {
        console.error('❌ Critical-path Playwright tests FAILED — fix before committing.');
        console.error(err.message || err);
        process.exit(1);
      }
    }
  }
}
