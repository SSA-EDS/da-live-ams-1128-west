# da-live-ams — FedRAMP DA Live Site

AMS fork of the da.live application, adapted for FedRAMP/GovCloud deployment.

## Context

@/Users/schmidt/Documents/git/eds_tools/ams-eds-terraform/.cursor/rules/da-live-govcloud-migration-overview.md
@/Users/schmidt/Documents/git/eds_tools/ams-eds-terraform/.cursor/rules/development-standards-shared.md

## What This Is

- Frontend application (AEM EDS site) for the DA content authoring interface
- Migrated from `da.live` upstream to run in FedRAMP-bounded environment
- Rebranded and re-pointed from `da.live` / `aem.live` origins to AMS endpoints

## Key Differences from Upstream

- Origin domains rebranded away from `da.live` / `aem.live`
- Storage backend points to AMS S3 (not Cloudflare R2 public)
- Auth flows adapted for FedRAMP identity providers

## Code bus vs content bus — diagnosing 404s

A request path in this app is served by one of three buses. Getting this wrong sends
you fixing the wrong thing. **Many "app assets" are DA content, not code** — the
Experience Workspace toolbar/canvas icons at `/img/icons/s2-icon-*.svg`, and `nav`/
`footer`, live in the DA content bucket, NOT in the GitHub repo. That is why they are
absent from `adobe/da-live` and `adobe/da-nx` on GitHub yet still serve on da.live.

- **Code bus** — files committed to the GitHub repo (`/blocks`, `/scripts`, `/styles`,
  and any static asset actually committed). Fix a 404 by committing the file.
- **Content bus** — authored docs + resources from the DA content source
  (`content.ent-da.live/<org>/<site>/`, mounted in `fstab.yaml`). Fix a 404 by
  uploading to the DA bucket and publishing — see `docs/da-content-publish.md`.
- **Media bus** — content-referenced binaries under hashed `/media_<hash>.<ext>` paths.

**Authoritative check — is a path code or content?**
```
curl -s "https://admin.ent-aem.page/status/<org>/<site>/main/<path>" | python3 -m json.tool
```
- `code.status: 200` → it's code → commit it to GitHub.
- `code.status: 404` but `preview.status`/`live.status: 200` → it's content → the fix is
  DA-bucket upload + preview + publish. `sourceLocation` shows the content origin.

**Do NOT** infer code-vs-content from the `main--<repo>--<org>` surrogate cache-tag
(it stamps *every* response through that delivery, code or content), and do NOT read a
`HEAD 405` or an unauthenticated `GET 401` from `content.ent-da.live` as "missing" — the
content API blanket-401s everything, existent or not. Only the status API above is decisive.

## Environment host map

All `*.ent-da.live` siblings resolve (`admin`, `content`, `collab`, `agent`, `feedback`),
**except** `preview.ent-da.live` / `stage-preview.ent-da.live` — the DA live-preview zone
has **no DNS record and no worker** in this environment (upstream's equivalent
`*.preview.da.live` does resolve). The canvas "Layout" split view builds
`https://main--<repo>--<org>.preview.ent-da.live` (`getPreviewOrigin` in
`blocks/canvas/editor-utils/editor-utils.js`) and loads it in an iframe, so Layout view
shows **"server IP address could not be found"** until that zone is provisioned (infra /
terraform task, not a code fix). The Content/prose pane works because it uses
`collab.ent-da.live`, which does resolve. Workaround to unblock authoring: set
`ew.canvasDefaultView=content` in the site's DA config flags.

## Branch Strategy

Same as all AMS repos:
- `main` — upstream mirror. Do not commit here.
- `main-ams` — primary working branch

## Related Repos

- `eds_workers/da-content-ams` — content proxy Worker for this site
- `eds_workers/da-admin` — DA admin Worker
- `eds_da_sites/da-nx-ams` — companion NX app
# DA Live — Project Instructions

## Branch Naming

Branches in this repo must be **max 8 lowercase alphanumeric characters** (no hyphens, underscores, or uppercase).

This is an IMS constraint — violating it breaks authentication in CI/CD and preview environments.

Good: `multiimg`, `fixauth`, `tabfix`
Bad: `fix-auth`, `my-feature-branch`, `Fix_Tabs`

Always enforce this when creating or suggesting branch names.
