# CF → DA Live (Structured Content) Converter

Converts an AEM Content Fragment to DA Live HTML Structured Content and
Franklin-publishes it to the EDS site.

## Files

| File | Purpose |
|------|---------|
| `convert.sh` | Shell script — suitable for CI/CD or local one-shot runs |
| `index.html` | Browser UI — visual tool, shows generated HTML, uploads to DA Live |

---

## Shell script usage

```bash
./tools/cf-to-sc/convert.sh <cf-path> [author-url] [da-live-org] [da-live-repo]
```

### Arguments

| # | Argument | Default |
|---|----------|---------|
| 1 | `cf-path` | *(required)* AEM DAM path to the CF |
| 2 | `author-url` | `https://author-p138879-e1741192.adobeaemcloud.com` |
| 3 | `da-live-org` | `pstolmar` |
| 4 | `da-live-repo` | `diagram-editor` |

### Example

```bash
./tools/cf-to-sc/convert.sh /content/dam/ue-demo/fragments/home-hero \
  https://author-p138879-e1741192.adobeaemcloud.com \
  pstolmar diagram-editor
```

### Authentication

The script needs two tokens:

**AEM Author token** — always sourced from `aio auth:token`. Run `aio login` first if expired.

**DA Live token** — checked in this order:
1. `$DA_LIVE_TOKEN` environment variable (preferred for CI)
2. Falls back to `aio auth:token` (the same AEM IMS token; works for adobe.com orgs)

```bash
# Option A — aio login covers both
aio login
./tools/cf-to-sc/convert.sh /content/dam/ue-demo/fragments/home-hero

# Option B — explicit DA Live token
export DA_LIVE_TOKEN="eyJ..."
./tools/cf-to-sc/convert.sh /content/dam/ue-demo/fragments/home-hero
```

---

## Browser UI

Open `tools/cf-to-sc/index.html` in a browser (file:// or served locally).

```bash
# Serve locally to avoid CORS issues
npx serve tools/cf-to-sc
# or
python3 -m http.server 8080 --directory tools/cf-to-sc
```

Fill in:
- **CF path** — `/content/dam/ue-demo/fragments/home-hero`
- **Author URL** — pre-filled with RDE URL
- **AEM Bearer token** — paste output of `aio auth:token`
- **DA Live org / repo** — pre-filled
- **DA Live token** — optional; defaults to the AEM token

Click **Convert & Upload**. The generated HTML appears immediately (reliable),
then the tool attempts the API calls.

> **CORS note:** Direct browser API calls to AEM Author and DA Live will fail
> when served from `file://` or a non-allowlisted origin. The generated HTML is
> always rendered locally — use **Copy HTML** and upload it manually at
> [da.live](https://da.live) if the API step fails.

---

## How to get a DA Live token

DA Live uses Adobe IMS. For adobe.com orgs the `aio auth:token` IMS token works.
For external orgs or personal accounts:

1. Go to [da.live](https://da.live) and sign in
2. Open browser DevTools → Network tab
3. Trigger any action → find a request to `admin.da.live`
4. Copy the `Authorization: Bearer eyJ…` header value

---

## DA Live API endpoints

| Operation | Method | URL |
|-----------|--------|-----|
| Create/update source | `PUT` | `https://admin.da.live/source/{org}/{repo}/{path}.html` |
| Read source | `GET` | `https://admin.da.live/source/{org}/{repo}/{path}.html` |
| List folder | `GET` | `https://admin.da.live/list/{org}/{repo}/{folder}` |
| Delete | `DELETE` | `https://admin.da.live/source/{org}/{repo}/{path}.html` |

The `PUT` body is a raw HTML document (`Content-Type: text/html; charset=utf-8`).

---

## Franklin (EDS) preview + publish pipeline

After uploading to DA Live, two POST requests trigger Franklin's preview and
live publish pipelines:

```
POST https://admin.hlx.page/preview/{org}/{repo}/main/{path}
POST https://admin.hlx.page/live/{org}/{repo}/main/{path}
```

These convert the DA Live HTML into EDS-optimised HTML on the CDN.

The resulting pages are served at:
- **Preview:** `https://main--{repo}--{org}.hlx.page/{path}`
- **Live:**    `https://main--{repo}--{org}.hlx.live/{path}`

For this project:
- Preview: `https://main--diagram-editor--pstolmar.hlx.page/ue-demo/fragments/home-hero`
- Live:    `https://main--diagram-editor--pstolmar.hlx.live/ue-demo/fragments/home-hero`

---

## DA Live path derivation

The CF DAM path is mapped to a DA Live path by stripping the `/content/dam/` prefix:

```
/content/dam/ue-demo/fragments/home-hero
              ↓
ue-demo/fragments/home-hero
```

The source URL becomes:
```
https://admin.da.live/source/pstolmar/diagram-editor/ue-demo/fragments/home-hero.html
```

---

## Output HTML format

The script produces an EDS block-table document. EDS renders the `<table>` as the
`hero` block, dispatching field content to the block's `decorate()` function.

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>home-hero</title></head>
<body>
<main>
  <div>
    <div>
      <table>
        <tr><th colspan="2">Hero</th></tr>
        <tr>
          <td><img src="/content/dam/…/rocket10.jpeg"></td>
          <td>
            <h2>Editable content from a remote app</h2>
            <p>Universal Editor SPA Demo</p>
            <p>This static SPA renders Universal Editor annotations…</p>
            <a href="#">Launch Fast</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
</main>
</body>
</html>
```

CF fields used (from the `home-hero` model):

| CF field | Block cell |
|----------|-----------|
| `contentReference` | `<img src="…">` in first `<td>` |
| `title` | `<h2>` in second `<td>` |
| `eyebrow` | `<p>` in second `<td>` |
| `description` | raw HTML in second `<td>` (may contain `<p>` tags) |
| `ctaLabel` | `<a href="#">…</a>` in second `<td>` |

---

## Related files

- `tools/setup-cf.sh` — Creates the home-hero CF on AEM Author
- `tools/content/README.md` — Vault package install instructions
- `blocks/` — EDS block implementations (including the `hero` block if present)
