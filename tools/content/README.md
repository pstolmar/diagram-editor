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
