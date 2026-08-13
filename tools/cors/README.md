# AEM RDE Author OSGi Configs — Universal Editor

## ⚡ Quick fix: "Failed to fetch details" in UE

```bash
bash tools/fix-ue.sh
```

That's it. The script deploys both required OSGi configs to RDE Author and confirms success.
If `aio` returns a 403, run `aio auth:login` first, then retry.

---

## What gets deployed

Both configs live in `/apps/wknd/osgiconfig/config.author/` on AEM Author.

**`CORSPolicyImpl~ue.cfg.json`** (in `ui.config-ue-cors-1.0.zip` / combined package)
- Allows `*.aem.live` and `*.aem.page` origins with credentials on Author
- Required so the SPA's `cors.js` can exchange an IMS token for an AEM Author session
- Without this: every CF fetch from the SPA returns 403 → UE shows "Failed to fetch details"

**`OAuthBearerAuthenticationHandler~universaleditor.cfg.json`** (in `ui.config-ue-bearer-1.0.zip` / combined)
- Allows `universal-editor-service.adobe.io` to authenticate to Author via Bearer token
- Required so the UE service can write CF edits back to AEM on behalf of the logged-in user
- Without this: edits silently fail or revert immediately

---

## Deploy commands

**Preferred — combined package (one command, can't forget one half):**
```bash
aio aem:rde:install tools/cors/ui.config-ue-combined-2.0.zip --target author
```

**Or separately:**
```bash
aio aem:rde:install tools/cors/ui.config-ue-cors-1.0.zip --target author
aio aem:rde:install tools/cors/ui.config-ue-bearer-1.0.zip --target author
```

---

## Why configs disappear

The RDE periodically resets. Any time it resets, these configs are gone and must be redeployed.

**Second cause (now prevented by pre-commit hook):** A vault package whose `filter.xml` uses a
*directory-level* filter like `root="/apps/wknd/osgiconfig/config.author"` will **replace the
entire directory** on install, deleting both UE configs. The pre-commit hook in `.husky/pre-commit.mjs`
now blocks any such package from being committed. File-level filters are always safe:
```xml
<!-- SAFE — targets exactly one file -->
<filter root="/apps/wknd/osgiconfig/config.author/com.example.MyConfig~name.cfg.json"/>

<!-- DANGEROUS — wipes everything in config.author -->
<filter root="/apps/wknd/osgiconfig/config.author"/>
```

---

## Still broken after redeploying?

1. **CF doesn't exist on Author** — open AEM Author Assets and confirm the fragment path exists  
2. **CF not published** — the SPA fetches from Publish; publish the CF from Author  
3. **Wrong `data-aue-resource`** — must end in `/jcr:content/data/master`, e.g.:  
   `urn:aem:/content/dam/ue-demo/fragments/home-hero/jcr:content/data/master`  
4. **IMS session expired** — open `experience.adobe.com` in the same browser to re-auth  
5. **RDE down** — run `aio aem:rde:status` to confirm the environment is healthy  

Use `tools/debugue.html` to inspect all `data-aue-*` attributes on a page and diagnose
instrumentation issues without needing the full UE.

---

## Publish-side CORS (GraphQL / CF queries)

`graphql-cors-v3.zip` covers Publish. Deploy **without** `--target` (goes to both tiers):
```bash
aio aem:rde:install ~/Downloads/graphql-cors-v3.zip
```
