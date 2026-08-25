# Bachelor of Science in Computer Science — Course Hub

A Cloudflare Pages course-resource website for organizing notes, tutorials,
practical files, project files and PYQs across all 8 semesters.

## What changed

The old version kept `fileCount` as a hardcoded number in `subjects.json` and
kept each subject's file list in separate `manifest.json` files. That is why a
subject could contain a real file while the card still displayed `0 files`.

This version fixes the root cause:

- A single resource list lives in `data/resources.json` for local/static use.
- In production, the same resource list can live in Cloudflare D1.
- Subject cards calculate their count from the actual resource entries.
- Subject tabs calculate category counts from the same resource data.
- A resource can point to a local PDF or an external URL (such as a shared
  Google Drive file).
- `admin.html` provides a simple form for adding a resource.

## Semester 1 subjects

- Python
- HTML
- CSS
- C++
- Data Engineering & Analytics
- Calculus
- Mechanics

## Add a resource

### Recommended production workflow

1. Upload the PDF to your chosen file host.
2. If using Google Drive, set General access to **Anyone with the link** and
   Viewer, then copy the link.
3. Open `/admin.html`.
4. Enter the resource name, URL, semester, subject and category.
5. Save it. The Pages Function writes the metadata to D1.
6. The public site immediately reads the resource list and recalculates counts.

The website does not need the PDF itself in GitHub when the resource uses an
external `url`.

### Resource schema

```json
{
  "id": "unique-id",
  "name": "Python Lecture 9 — Functions",
  "url": "https://drive.google.com/...",
  "semester": 1,
  "subject": "python",
  "category": "notes"
}
```

Categories are:

- `notes`
- `tutorials`
- `practicals`
- `project`
- `pyqs`

## Cloudflare D1 setup

The site is designed to remain a normal Cloudflare Pages project while using a
Pages Function at `/api/resources` for the resource API. Cloudflare Pages
Functions support D1 bindings. See the official Cloudflare documentation for
Pages Functions bindings.

1. Create a D1 database named `bsc-cs-resources`.
2. Run `schema.sql` against it.
3. Run `seed.sql` against it once to insert the current starter resources.
4. In the Cloudflare Pages project, add a D1 binding named `DB` pointing to
   the database.
5. Add a secret named `ADMIN_TOKEN` to the Pages project. Use a long random
   value and keep it private.
6. Redeploy the Pages project.
7. Open `/admin.html` and enter the same token when adding a resource.

Cloudflare's current Workers Free plan includes D1 usage suitable for a small
student resource catalogue: 5 million rows read/day, 100,000 rows written/day,
and 5 GB D1 storage. See the official D1 pricing/limits documentation before
scaling the project.

## Local testing

From the project folder:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Without a D1 binding, the website automatically falls back to
`data/resources.json`. The local admin form can export a `resource-entry.json`
object for manual insertion into that file.

## Cloudflare + GitHub

Keep using the GitHub-connected Cloudflare Pages project. Cloudflare Pages Git
integration automatically deploys when changes are pushed to the connected
repository.

For production resource adding, the important distinction is:

```text
PDF/file hosting: Google Drive (or another file host)
                    |
                    v
Resource metadata: Cloudflare D1
                    |
                    v
Website: Cloudflare Pages + Pages Function
```

This keeps PDFs out of the Git repository when you use external URLs while
keeping the resource index fast and queryable.
