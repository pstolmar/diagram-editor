# AEM RDE Author OSGi Configs

These packages must be deployed to the RDE Author to enable Universal Editor CF editing.

## Deploy both (in order):

```bash
aio aem:rde:install tools/cors/ui.config-ue-cors-1.0.zip --target author
aio aem:rde:install tools/cors/ui.config-ue-bearer-1.0.zip --target author
```

## What each does

**ui.config-ue-cors-1.0.zip** — Author CORS policy (`CORSPolicyImpl~ue`)
- Allows `*.aem.live` and `*.aem.page` origins with credentials
- Required so cors.js (running in the SPA) can get an AEM Author session token

**ui.config-ue-bearer-1.0.zip** — IMS Bearer auth handler (`OAuthBearerAuthenticationHandler~universaleditor`)
- Allows `universal-editor-service.adobe.io` to authenticate via Bearer token
- Required so the UE service can call AEM Author on behalf of the logged-in user

## Also required (already deployed separately)

`graphql-cors-v3.zip` → Publish CORS for GraphQL CF queries (deploy without `--target`)
