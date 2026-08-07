#!/usr/bin/env bash
# Generates and installs the glass-facades site styles package directly.
# No git pull needed — creates the ZIP from scratch every time.
set -euo pipefail

ZIP=$(mktemp /tmp/glass-facades-styles-XXXX.zip)

python3 - "$ZIP" <<'PYEOF'
import zipfile, sys

out = sys.argv[1]

css = b"""<!--/* glass-facades site styles */-->
<style>
.aem-Grid{display:block;width:100%}
.aem-Grid::before,.aem-Grid::after{display:table;content:" "}
.aem-Grid::after{clear:both}
.aem-GridColumn{float:left;box-sizing:border-box}
.aem-GridColumn--default--1{width:8.33333333%}
.aem-GridColumn--default--2{width:16.66666667%}
.aem-GridColumn--default--3{width:25%}
.aem-GridColumn--default--4{width:33.33333333%}
.aem-GridColumn--default--5{width:41.66666667%}
.aem-GridColumn--default--6{width:50%}
.aem-GridColumn--default--7{width:58.33333333%}
.aem-GridColumn--default--8{width:66.66666667%}
.aem-GridColumn--default--9{width:75%}
.aem-GridColumn--default--10{width:83.33333333%}
.aem-GridColumn--default--11{width:91.66666667%}
.aem-GridColumn--default--12{width:100%}
@media(max-width:650px){.aem-GridColumn{width:100%!important;float:none}}
a.cmp-button{display:inline-block;background-color:#1473e6;color:#fff;border-radius:8px;padding:8px 20px;font-size:.875rem;font-weight:600;text-decoration:none;white-space:nowrap}
a.cmp-button:hover{background-color:#0d66d0}
.cmp-button__text{color:inherit}
.cmp-image__image{max-width:100%;height:auto;display:block}
</style>
"""

filter_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
  <filter root="/apps/core/wcm/components/page/v3/page/customheaderlibs.html"/>
</workspaceFilter>
"""

props = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
  <entry key="name">glass-facades-site-styles</entry>
  <entry key="version">2.0</entry>
  <entry key="group">glass-facades-demo</entry>
  <entry key="packageType">application</entry>
</properties>
"""

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d in ["META-INF/","META-INF/vault/","jcr_root/","jcr_root/apps/",
              "jcr_root/apps/core/","jcr_root/apps/core/wcm/",
              "jcr_root/apps/core/wcm/components/",
              "jcr_root/apps/core/wcm/components/page/",
              "jcr_root/apps/core/wcm/components/page/v3/",
              "jcr_root/apps/core/wcm/components/page/v3/page/"]:
        z.writestr(zipfile.ZipInfo(d), b"")
    z.writestr("META-INF/vault/filter.xml", filter_xml)
    z.writestr("META-INF/vault/properties.xml", props)
    z.writestr("jcr_root/apps/core/wcm/components/page/v3/page/customheaderlibs.html", css)

print(f"Built {out}")
PYEOF

echo "Installing..."
aio aem rde install "$ZIP"
echo "Done. Hard-refresh the page."
rm -f "$ZIP"
