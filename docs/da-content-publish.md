# DA content publish runbook

How to get a **content-bus** resource (authored doc, or an app asset that lives in the DA
bucket — e.g. `/img/icons/s2-icon-*.svg`, `nav`, `footer`) to serve on this fork.

> First decide whether the thing you're fixing is even content. Many app assets are DA
> content, not code. See **"Code bus vs content bus — diagnosing 404s"** in `CLAUDE.md`.
> Short version: `curl -s https://admin.ent-aem.page/status/<org>/<site>/main/<path>` —
> if `code.status:404` but `preview/live` want to be `200`, it's content and this runbook
> applies. If `code.status:200`, it's code — just commit it to GitHub instead.

## The lifecycle

Three hops. The auth differs between hop 1 and hops 2–3 — this is the part that bites:

| Hop | Endpoint | Auth |
|-----|----------|------|
| 1. Source (write to DA bucket) | `POST https://admin.ent-da.live/source/<org>/<site>/<path>` | `Authorization: Bearer <IMS>` |
| 2. Preview | `POST https://admin.ent-aem.page/preview/<org>/<site>/main/<path>` | `Authorization: Bearer <IMS>` **and** `x-content-source-authorization: Bearer <IMS>` |
| 3. Live (publish) | `POST https://admin.ent-aem.page/live/<org>/<site>/main/<path>` | same two headers |

The 2nd header on hops 2–3 is what AEM presents back to DA to read the source. Omit it and
you get **401 even with a valid token** — the classic symptom is "DA source call 200 but
preview/live 401." IMS tokens are short-lived; re-export before a batch.

## Setup

```bash
cd /Users/agrimes/adobe/eds-ams-ssa/eds_sites/da-live-ams-1128-west
export ORG=ssa-eds
export SITE=da-live-ams-1128-west
export DA_TOKEN='PASTE_DA_IMS_TOKEN'
export AEM_TOKEN="$DA_TOKEN"   # change only if your AEM admin token differs
```

## 1. Always test ONE file first

Verify tokens + flow before batching. Example for a single asset `$f` (repo-relative path,
e.g. `img/icons/s2-icon-tagbold-20-n.svg`):

```bash
f=img/icons/s2-icon-tagbold-20-n.svg
echo "source :"; curl -sS -X POST "https://admin.ent-da.live/source/$ORG/$SITE/$f" -H "Authorization: Bearer $DA_TOKEN" -F "data=@$f;type=image/svg+xml" -o /dev/null -w "  %{http_code}\n"
echo "preview:"; curl -sS -X POST "https://admin.ent-aem.page/preview/$ORG/$SITE/main/$f" -H "Authorization: Bearer $AEM_TOKEN" -H "x-content-source-authorization: Bearer $DA_TOKEN" -o /dev/null -w "  %{http_code}\n"
echo "live   :"; curl -sS -X POST "https://admin.ent-aem.page/live/$ORG/$SITE/main/$f" -H "Authorization: Bearer $AEM_TOKEN" -H "x-content-source-authorization: Bearer $DA_TOKEN" -o /dev/null -w "  %{http_code}\n"
```

Expect `200`/`201` on source, `200` on preview/live. Debug: source `401` → DA token;
preview/live `401` → AEM token or the missing `x-content-source-authorization` header.

Adjust `;type=...` to the asset's MIME (`image/svg+xml`, `text/html`, etc.).

## 2. Batch

Files can come from anywhere; this example uses untracked files under `img/icons/`:

```bash
for f in $(git ls-files --others --exclude-standard img/icons); do
  s=$(curl -sS -X POST "https://admin.ent-da.live/source/$ORG/$SITE/$f" -H "Authorization: Bearer $DA_TOKEN" -F "data=@$f;type=image/svg+xml" -o /dev/null -w "%{http_code}")
  p=$(curl -sS -X POST "https://admin.ent-aem.page/preview/$ORG/$SITE/main/$f" -H "Authorization: Bearer $AEM_TOKEN" -H "x-content-source-authorization: Bearer $DA_TOKEN" -o /dev/null -w "%{http_code}")
  l=$(curl -sS -X POST "https://admin.ent-aem.page/live/$ORG/$SITE/main/$f" -H "Authorization: Bearer $AEM_TOKEN" -H "x-content-source-authorization: Bearer $DA_TOKEN" -o /dev/null -w "%{http_code}")
  printf "src=%s prev=%s live=%s  %s\n" "$s" "$p" "$l" "$f"
done
```

## 3. Verify (no auth needed)

```bash
# authoritative status
curl -s "https://admin.ent-aem.page/status/$ORG/$SITE/main/<path>" | python3 -c "import sys,json;d=json.load(sys.stdin);print('code',d.get('code',{}).get('status'),'| preview',d.get('preview',{}).get('status'),'| live',d.get('live',{}).get('status'))"
# production host
curl -s -o /dev/null -w "%{http_code}\n" "https://ent-da.live/<path>"
```

Want `preview=200`, `live=200`, production `200`. `code=404` staying is **correct** for
content — it means the resource is not (and should not be) in the code repo.

## Gotchas learned the hard way

- **Don't trust cache-tags or HEAD/GET status to classify code-vs-content.** The
  `main--<repo>--<org>` surrogate tag stamps every response; `content.ent-da.live` returns
  `401` for everything (existent or not) and `405` on `HEAD`. Only the AEM status API is decisive.
- **Icon reference scan:** the canvas toolbar builds `s2-icon-${name}` from a command's
  `icon` field, which is set both via `iconName('X')` (lowercased, dashes stripped) **and**
  bare literals like `icon: 'unlink'` in `blocks/canvas/editor-utils/command-defs.js`. Scan
  for both patterns or you'll miss some. Canonical bytes:
  `https://main--da-live--adobe.aem.live/img/icons/<file>` (each SVG has `id="icon"`, used
  via `<use href="...svg#icon">`).
- **This is the same class of work as mirroring `nav`/`footer`** across DA environments —
  they're all content-bucket resources, not code.
