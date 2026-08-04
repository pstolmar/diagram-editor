# Content Packages

AEM content packages for demo fragments. Deploy to RDE after deploying CORS configs.

## angular-hero — `ui.content-angular-hero-1.3.zip`

Creates the `angular-hero` Content Fragment used by `tools/ue-spa-demo/angular.html`.

- **Path:** `/content/dam/ue-demo/fragments/angular-hero`
- **Model:** `/conf/ue-demo/settings/dam/cfm/models/hero`
- **Fields:** eyebrow, title, description, ctaLabel

### Option A — aio CLI

```bash
aio aem:rde:install tools/content/ui.content-angular-hero-1.3.zip --target author
```

After install, publish the fragment so GraphQL on Publish serves it.

### Option B — AEM Package Manager (more reliable)

1. Open `https://author-p138879-e1741192.adobeaemcloud.com/crx/packmgr/index.jsp`
2. Upload → select `tools/content/ui.content-angular-hero-1.1.zip` → Install
3. Verify node at `/content/dam/ue-demo/fragments/angular-hero` in CRXDE

### Option C — Author UI (most reliable)

If the package still doesn't show the CF in Assets:

1. Open AEM Author > Assets > Files > ue-demo > fragments
2. Create > Content Fragment > select **hero** model
3. Name: `angular-hero`
4. Open and set:
   - **Eyebrow:** `AEM Hybrid · Angular`
   - **Title:** `Investment Portfolio Dashboard`
   - **Description:** `Angular-powered analytics with real-time data — content authored and personalized in AEM Universal Editor without touching code.`
   - **CTA Label:** `View Dashboard`
5. Save + Close, then Quick Publish
