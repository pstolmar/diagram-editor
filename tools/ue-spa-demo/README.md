# Universal Editor SPA Demo for EDS `tools/`

This is a tiny static SPA-style demo that can be copied into an Edge Delivery Services repo at:

```text
tools/ue-spa-demo/
```

It demonstrates Universal Editor overlay instrumentation using `data-aue-*` attributes. It can run with bundled demo content, or fetch Content Fragment data from an AEM GraphQL endpoint.

## What this is for

- A quick Universal Editor demo for a remotely hosted SPA.
- A low-overhead alternative to Adobe I/O App Builder when you only need to show in-context editing.
- A place to show Content Fragment-backed fields with Universal Editor annotations.

App Builder is useful when you need Universal Editor extensions or Adobe shell integration. For a simple editable remote app, static HTTPS hosting is enough.

## Configure

Edit both `index.html` and `config.js`.

Required for a real AEM demo:

In `index.html`, set the Universal Editor AEM connection:

```html
<meta
  name="urn:adobe:aue:system:aem"
  content="aem:https://author-pXXXXX-eYYYYYY.adobeaemcloud.com"
/>
```

In `config.js`, use the same author URL and point at the editable resource:

```js
authorUrl: 'https://author-pXXXXX-eYYYYYY.adobeaemcloud.com',
fragmentResource: '/content/dam/YOUR_PROJECT/YOUR_FRAGMENT',
```

Optional, if fetching Content Fragment content:

```js
graphQlEndpoint: 'https://publish-pXXXXX-eYYYYYY.adobeaemcloud.com/graphql/execute.json/YOUR_PROJECT/YOUR_QUERY',
```

If `graphQlEndpoint` is blank, the demo uses local fallback content and still renders Universal Editor overlays. Saving edits still requires `fragmentResource` to point at a real editable AEM resource.

## Host

In an EDS repo, commit this folder under `tools/ue-spa-demo/`. After it is published, open the HTTPS URL for the tool in Universal Editor.

For local smoke testing only:

```sh
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/tools/ue-spa-demo/
```

Universal Editor itself needs a reachable HTTPS URL for a realistic remote-app demo.

## Notes

- The `meta[name="urn:adobe:aue:system:aem"]` tag is declared in `index.html` so Universal Editor can see the AEM connection before the app JavaScript runs.
- `app.js` also refreshes that meta tag from `config.js` at runtime; keep both values aligned.
- Editable resources use the matching `urn:aem:/content/...` prefix.
- The Universal Editor CORS helper is loaded from `https://universal-editor-service.adobe.io/cors.js`.
- Editability comes from `data-aue-resource`, `data-aue-prop`, `data-aue-type`, and related attributes in the rendered DOM.
- The exact Content Fragment field names must match your model/query.
