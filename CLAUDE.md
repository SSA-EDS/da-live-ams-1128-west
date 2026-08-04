# da-live-ams-1128-west — ent-da.live DA Site

AMS fork of the da.live application, adapted for testing Helix 6 in bpbu1128 us-west-2

## Context

@/Users/schmidt/Documents/git/eds_tools/ams-eds-terraform/.cursor/rules/da-live-govcloud-migration-overview.md
@/Users/schmidt/Documents/git/eds_tools/ams-eds-terraform/.cursor/rules/development-standards-shared.md

## What This Is

- Frontend application (AEM EDS site) for the DA content authoring interface
- Migrated from `da.live` upstream to run in bpbu1128 us-west-2 environment
- Created with the purpose of testing Helix 6
- Rebranded and re-pointed from `da.live` / `aem.live` origins to AMS endpoints

## Key Differences from Upstream

- Origin domains rebranded away from `da.live` / `aem.live`
- Storage backend points to AMS S3 (not Cloudflare R2 public)

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
  **Content-addressed:** the hash is derived from the **original uploaded bytes**.
  Re-uploading the *identical original* reproduces the *identical hash* — so you can seed
  this fork's media bus at the **same hash upstream uses**, and static code templates that
  hardcode upstream media URLs (e.g. `404.html`) keep working with **zero code edits**
  (this is how the 404-page images were fixed — see `ENV-JOURNAL.md` 2026-08-03).
  Corollary: the served `/media_<hash>` is re-encoded/optimized, so `shasum` of the
  downloaded file will **not** equal the hash — never verify identity that way; use the
  status API.

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

## Renders blank / empty — not a 404

A resource can return `200` and still not display. Two causes seen repeatedly:

- **App chrome is content *fragments*.** The left rail and top nav are built from
  `/nx/fragments/sidenav` and `/nx/fragments/nav` (the **da-nx** site's content), whose
  `<a>` links must each contain `<span class="icon icon-NAME">`. A blank rail with **no**
  404s means the fragment is a **stub missing its icon spans** — fix the fragment content,
  not the icons. New forks often get these seeded incomplete.
  - `/fragments/exp-workspace/nav` (the workspace breadcrumb+actions bar; set as the
    `nav-path` meta by `nx/blocks/form/form.js`) is **da-live site content**, not nx
    (da.live serves it; the nx host 404s). It needs **two EDS sections**: §1 brand (first
    `<a>` = brand link, then a `breadcrumbs` bullet), §2 action (`feedback`, `ew-actions`,
    `profile` bullets). One section = won't parse into brand vs action.
- **`<use href>` fragment-id mismatch.** Icons render via `<use href="…svg#id">`. Lowercase
  literals (`s2-icon-*`) need `id="icon"`; the nx2 decorator builds
  `S2_Icon_<Name>_20_N.svg#<name>` and needs `id="<name>"`. Right file + wrong `#id` =
  loads but paints nothing.

## nx runtime version — `/nx` (v1) vs `/nx2` (v2)

`getNx()` (`scripts/utils.js`) returns `/nx` or `/nx2` depending on the `nxver` flag;
`getNx2()` always returns `/nx2`. The v2-only shared components — `dialog`, `picker`,
`popover`, `menu` — exist **only** under `/nx2`. Running v1 when v2 is needed shows as
`Failed to fetch dynamically imported module …/nx/blocks/shared/dialog/dialog.js`, or a
dead nav/rail.

`nxver=2` is **not** in `head.html`, **not** in bulk `metadata.json`, and **not** authored
in a doc's metadata block. da.live sets it as **per-route config-service metadata** on the
v2 surfaces — `/`, `/edit`, `/canvas`, `/media`, `/sheet` — **not** `/**` (`/config` is
intentionally left on v1). Per-doc `nxver` works but is a stopgap; the scalable fix is a
per-route rule in the site config. This fork's site config is under-provisioned
(`admin.ent-da.live/config/<org>/<site>/` → 404), which is why the flag is missing.

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

## Which checkout serves `ent-da.live`?

Two repos, split by path — make sure you're editing the right one:
- **`da-live-ams-1128-west`** — site root: app shell, `/edit`, `/404.html`,
  `/fragments/*`, `/media_*`, `/img/*`.
- **`da-nx-ams-1128-west`** — nx runtime under `/nx` and `/nx2`.

Beware sibling look-alike checkouts in the same parent dir:
- `da-live-ams` / `da-nx-ams` (non-`-1128-west`) — different deployment.
- `hlx6-da-live` — serves **entmseds-da.live**, a *different* host.
- pristine `da-live` / `da-nx` — **stale** upstream mirrors; do **not** source assets from
  them (use live da.live or `main--da-live--adobe.aem.live`).

Confirm the target before editing: `fstab.yaml` → `mountpoints./.url`.

## Branch Strategy

DA has hard-coded references to the 'main' branch. For simplicity sake, leaving "main" as the primary working branch.
- `main` — primary working branch


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
