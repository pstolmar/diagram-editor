# Content Packages

AEM content packages for demo fragments. Deploy to RDE after deploying CORS configs.

## angular-hero — `ui.content-angular-hero-1.0.zip`

Creates the `angular-hero` Content Fragment used by `tools/ue-spa-demo/angular.html`.

- **Path:** `/content/dam/ue-demo/fragments/angular-hero`
- **Model:** `/conf/ue-demo/settings/dam/cfm/models/hero`
- **Fields:** eyebrow, title, description, ctaLabel

### Deploy

```bash
aio aem:rde:install tools/content/ui.content-angular-hero-1.0.zip
```

After install, publish the fragment in AEM Author (or use Quick Publish) so GraphQL on Publish serves it.
