# Content Packages

## Creating demo Content Fragments on RDE

**Do not use vault packages to create Content Fragments.** Manually-built vault packages produce malformed JCR nodes that the CF REST API cannot read (`name is null`, etc.).

### Correct approach

1. In AEM Author Assets UI, copy an existing working fragment (e.g. `offers-home-hero`) to the new path
2. Open the copy in the CF editor and update the field values
3. Quick Publish to Publish so GraphQL can serve it

### angular-hero

- **Path:** `/content/dam/ue-demo/fragments/angular-hero`
- **Model:** `home-hero`
- Created by copying `offers-home-hero` in AEM Author Assets UI

---

## Core Components Showcase Page

### What these packages create

- **ui.content.core-showcase-1.0.zip** — A demo page at `/content/glass-facades/en/offers/core-showcase`
  using AEM Core Components (Title, Text, Image, Teaser) + an existing Experience Fragment
  (`/content/experience-fragments/glass-facades/fr_fr/site/offers/xf-translate-test/formal-french-text-custom-image-xf`)

- **ui.apps.core-showcase-theme-1.0.zip** — Minimal CSS clientlib for clean Core Components
  rendering on RDE Publish (no external dependencies, category: `glass-facades-demo.theme`)

### Deploy commands (RDE: p138879-e1741192)

```bash
# Step 1 — Deploy content page to Author (will auto-replicate structure)
aio aem rde:deploy tools/content/ui.content.core-showcase-1.0.zip --target author

# Step 2 — Deploy CSS clientlib to BOTH Author and Publish
aio aem rde:deploy tools/content/ui.apps.core-showcase-theme-1.0.zip

# Step 3 — Open Author and manually publish the page
# OR use the Replication API:
curl -u admin:admin \
  -X POST "https://author-p138879-e1741192.adobeaemcloud.com/bin/replicate.json" \
  -d "path=/content/glass-facades/en/offers/core-showcase" \
  -d "cmd=Activate"

# Step 4 — Add clientlib to page (if not auto-loaded by template)
# Open the page in AEM Author → Page Properties → Advanced → Client Libraries
# Add: glass-facades-demo.theme
# OR in CRXDE add to jcr_content node: cq:clientlibs = [glass-facades-demo.theme]

# View on Publish:
# https://publish-p138879-e1741192.adobeaemcloud.com/content/glass-facades/en/offers/core-showcase.html
```

### Note on template compatibility

If the page renders as a blank white page, the `sling:resourceType` needs to match the
glass-facades site's actual page component. Use CRXDE to check the existing glass-facades
pages for their `sling:resourceType`, then update `jcr_content/.content.xml` and redeploy.
