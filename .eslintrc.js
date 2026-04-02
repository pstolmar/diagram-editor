module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:json/recommended',
    'plugin:xwalk/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
    // card-reveal-hero-tab needs 10 cells (icon, label, heading, bodyText, ctaLabel, ctaHref,
    // panelImage, popupImage, animationPreset, celebrationVariant); all other models keep default 4
    'xwalk/max-cells': ['error', { 'card-reveal-hero-tab': 10, '*': 4 }],
    // bodyText intentionally uses the Text suffix without a base 'body' field —
    // the JCR property name must stay bodyText to match existing authored content
    'xwalk/no-orphan-collapsible-fields': 'warn',
  },
};
