# Content Packages

## home-hero Content Fragment

**`ui.content.home-hero-cf-1.0.zip`** — Creates `/content/dam/ue-demo/fragments/home-hero`
with `contentFragment=true`, the `home-hero` CF model reference, and pre-filled field values
for the Angular + UE demo.

```bash
aio aem rde install tools/content/ui.content.home-hero-cf-1.0.zip -s author
```

After install, open `/content/dam/ue-demo/fragments/home-hero` in AEM Author Assets UI
and **Quick Publish** to replicate to Publish.

### If the package fails (wrong cq:model path)

The `cq:model` in the package points to `/conf/glass-facades/settings/dam/cfm/models/home-hero`.
If your AEM conf uses a different path, use the setup script instead — it auto-detects the model
from any existing sibling fragment:

```bash
chmod +x tools/setup-cf.sh
./tools/setup-cf.sh https://author-p138879-e1741192.adobeaemcloud.com
```

---

## Core Components Showcase Page

### What these packages create

- **ui.content.core-showcase-1.0.zip** — A demo page at `/content/glass-facades/en/offers/core-showcase`
  using AEM Core Components (Title, Text, Image, Teaser) + an existing Experience Fragment
  (`/content/experience-fragments/glass-facades/fr_fr/site/offers/xf-translate-test/formal-french-text-custom-image-xf`)

- **ui.apps.core-showcase-theme-1.0.zip** — Minimal CSS clientlib for clean Core Components
  rendering on RDE Publish (no external dependencies, category: `glass-facades-demo.theme`)

### Install commands (RDE: p138879-e1741192)

```bash
# Step 1 — Install content page to Author
aio aem rde install tools/content/ui.content.core-showcase-1.0.zip --target author

# Step 2 — Install CSS clientlib to BOTH Author and Publish
aio aem rde install tools/content/ui.apps.core-showcase-theme-1.0.zip

# Step 3 — Add clientlib to page (if not auto-loaded by template)
# Open the page in AEM Author → Page Properties → Advanced → Client Libraries
# Add: glass-facades-demo.theme
# OR in CRXDE add to jcr_content node: cq:clientlibs = [glass-facades-demo.theme]

# View on Publish (after manually publishing the page in Author):
# https://publish-p138879-e1741192.adobeaemcloud.com/content/glass-facades/en/offers/core-showcase.html
```

### Note on template compatibility

If the page renders as a blank white page, the `sling:resourceType` needs to match the
glass-facades site's actual page component. Use CRXDE to check the existing glass-facades
pages for their `sling:resourceType`, then update `jcr_content/.content.xml` and reinstall.
