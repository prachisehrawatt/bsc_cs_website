# Cloudflare setup checklist

## 1. Keep GitHub + Cloudflare Pages

Use the same GitHub-connected Pages project. Pages Git integration automatically redeploys after a push.

## 2. Create D1

From the project folder, after installing Wrangler and logging in to Cloudflare:

```bash
npx wrangler d1 create bsc-cs-resources
```

Copy the returned database ID.

## 3. Initialize the database

Run the schema against the remote database:

```bash
npx wrangler d1 execute bsc-cs-resources --remote --file=schema.sql
```

Then seed the starter resources:

```bash
npx wrangler d1 execute bsc-cs-resources --remote --file=seed.sql
```

## 4. Bind D1 to the Pages project

Cloudflare dashboard:

Workers & Pages → your Pages project → Settings → Bindings → Add → D1 database.

Use:

- Variable name: `DB`
- Database: `bsc-cs-resources`

Redeploy the Pages project after adding the binding.

## 5. Add the admin secret

In the Pages project's environment variables/secrets, create:

- Name: `ADMIN_TOKEN`
- Type: Secret
- Value: a long random private string

Do not put this token in GitHub or in frontend JavaScript.

## 6. Add a file

Upload the PDF to your file host. For Google Drive:

- Share the file
- General access → Anyone with the link
- Role → Viewer
- Copy link

Then open:

```text
https://YOUR-SITE.pages.dev/admin.html
```

Enter:

- Resource name
- File URL
- Semester
- Subject
- Category
- Admin token

Click **Save resource**.

The resource is written to D1. The website reads the D1 resource list and recalculates the subject/category counts automatically.

## 7. If D1 is not configured yet

The public site still works from `data/resources.json` locally/static. The Admin page has an **Export JSON entry** fallback so a new resource can be prepared without changing HTML.
