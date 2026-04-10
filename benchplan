[PATCH] [MISER=8]
Plan an EDS / Universal Editor-only "image-compare" component in this repo with the following behavior:

- Block name: image-compare
- Authoring:
  - Author can select two images (left/right) plus optional captions.
  - Block can be authored on an existing demo page (e.g. /demo/experiandemo) in UE.
  - XWalk/UE models should expose fields for left image, right image, and captions.
- Rendering:
  - Horizontally stacked images with a draggable vertical slider overlay for "before/after" comparison.
  - Default position: 50/50 split.
  - Keyboard accessible (arrow keys to move slider, focusable handle with visible outline).
  - Works on desktop and mobile; degrades gracefully if JS is disabled.
- Implementation constraints:
  - Use the existing EDS block pattern in this repo (blocks/<name>/, decorate(block), CSS alongside).
  - No external JS libs; only vanilla JS and CSS.
  - Do NOT remove or break existing demo pages.
- Testing:
  - Add or extend a Playwright test to:
    - Navigate to a page that contains the image-compare block.
    - Assert that the slider handle is visible and keyboard focusable.
    - Simulate a small slider move and assert that left/right image widths change.
- Lint + build:
  - Ensure ESLint + Stylelint pass.
  - Ensure build:json and component-model aggregation include the new block.

PLAN ONLY. Do NOT run commands yourself. Produce a compact JobSpec JSON for my executor that:
- Uses local tools first (eslint --fix, stylelint --fix, npm run build:json, npx playwright test).
- Avoids full-file rewrites unless needed.
- Uses patch-style edits where possible.
:::
