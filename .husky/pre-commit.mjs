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
      await run('curl -sfL --max-time 3 -o /dev/null http://localhost:3000');
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
