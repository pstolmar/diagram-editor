import { demoConfig } from './config.js';

const app = document.querySelector('#app');

function addAemConnection(authorUrl) {
  const existing = document.querySelector(
    'meta[name="urn:adobe:aue:system:aem"]',
  );

  if (existing) {
    existing.content = `aem:${authorUrl}`;
    return;
  }

  const meta = document.createElement('meta');
  meta.name = 'urn:adobe:aue:system:aem';
  meta.content = `aem:${authorUrl}`;
  document.head.append(meta);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeGraphQlPayload(payload) {
  const item =
    payload?.data?.homeHeroByPath?.item ||
    payload?.data?.heroByPath?.item ||
    payload?.data?.fragmentByPath?.item ||
    payload?.data?.contentFragmentByPath?.item ||
    payload?.data?.item ||
    payload?.data ||
    payload;

  const image = item?.contentReference?._publishUrl
    || item?.contentReference?._path
    || item?.image?._publishUrl
    || item?.image;

  const description = item?.description?.plaintext
    || item?.description?.html
    || item?.description;

  return {
    ...demoConfig.fallbackContent,
    ...item,
    ...(image && { image }),
    ...(description && { description }),
  };
}

async function loadContent() {
  if (!demoConfig.graphQlEndpoint) {
    return demoConfig.fallbackContent;
  }

  const response = await fetch(demoConfig.graphQlEndpoint, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed with ${response.status}`);
  }

  return normalizeGraphQlPayload(await response.json());
}

function render(content) {
  const fragmentVariation = demoConfig.fragmentVariation || 'master';
  const resource = `urn:aem:${demoConfig.fragmentResource}/jcr:content/data/${fragmentVariation}`;

  app.innerHTML = `
    <section
      class="hero"
      data-aue-resource="${escapeHtml(resource)}"
      data-aue-type="component"
      data-aue-label="Hero Content Fragment"
      data-aue-model="hero"
    >
      <div class="hero__media">
        <img
          src="${escapeHtml(content.image)}"
          alt=""
          data-aue-resource="${escapeHtml(resource)}"
          data-aue-prop="contentReference"
          data-aue-type="image"
          data-aue-label="Hero Image"
        />
      </div>

      <div class="hero__content">
        <p
          class="eyebrow"
          data-aue-resource="${escapeHtml(resource)}"
          data-aue-prop="eyebrow"
          data-aue-type="text"
          data-aue-label="Eyebrow"
        >${escapeHtml(content.eyebrow)}</p>

        <h1
          data-aue-resource="${escapeHtml(resource)}"
          data-aue-prop="title"
          data-aue-type="text"
          data-aue-label="Title"
        >${escapeHtml(content.title)}</h1>

        <p
          class="description"
          data-aue-resource="${escapeHtml(resource)}"
          data-aue-prop="description"
          data-aue-type="richtext"
          data-aue-label="Description"
        >${escapeHtml(content.description)}</p>

        <a
          class="button"
          href="#content"
          data-aue-resource="${escapeHtml(resource)}"
          data-aue-prop="ctaLabel"
          data-aue-type="text"
          data-aue-label="CTA Label"
        >${escapeHtml(content.ctaLabel)}</a>
      </div>
    </section>

    <section id="content" class="panel">
      <h2>Remote SPA surface</h2>
      <p>
        This page is static and framework-free, but behaves like a decoupled app:
        it can fetch content, render client-side, and expose editable fields to
        Universal Editor through DOM annotations.
      </p>
    </section>
  `;
}

async function init() {
  addAemConnection(demoConfig.authorUrl);

  try {
    render(await loadContent());
  } catch (error) {
    console.error(error);
    render(demoConfig.fallbackContent);
    app.insertAdjacentHTML(
      'beforeend',
      `<p class="notice">Using fallback content because remote content could not be loaded.</p>`,
    );
  }
}

init();
