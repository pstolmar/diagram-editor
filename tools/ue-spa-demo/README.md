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

Edit `config.js`.

Required for a real AEM demo:

```js
authorUrl: 'https://author-pXXXXX-eYYYYYY.adobeaemcloud.com',
fragmentResource: '/content/dam/YOUR_PROJECT/YOUR_FRAGMENT',
```

Optional, if fetching Content Fragment content:

```js
graphQlEndpoint: 'https://publish-pXXXXX-eYYYYYY.adobeaemcloud.com/graphql/execute.json/YOUR_PROJECT/YOUR_QUERY',
```

If `graphQlEndpoint` is blank, the demo uses local fallback content and still renders Universal Editor overlays.

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

- The `meta[name="urn:adobe:aue:system:aemconnection"]` tag is created dynamically from `config.js`.
- The Universal Editor CORS helper is loaded from `https://universal-editor-service.adobe.io/cors.js`.
- Editability comes from `data-aue-resource`, `data-aue-prop`, `data-aue-type`, and related attributes in the rendered DOM.
- The exact Content Fragment field names must match your model/query.

