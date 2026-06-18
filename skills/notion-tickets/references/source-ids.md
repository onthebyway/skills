# Finding Notion Source URLs and IDs

The `--source` value can be a full Notion URL or an ID. URLs are easiest and safest to copy.

## Copy a page URL

1. Open the Notion page.
2. Click `Share` or the `...` page menu.
3. Click `Copy link`.
4. Use that full URL:

```bash
node scripts/notion-tickets.ts inspect --source "https://www.notion.so/workspace/Page-Name-11111111111111111111111111111111"
```

If the page contains exactly one child database, the script will discover and use it. If it contains multiple child databases, pass `--database-name` or `--data-source-id`.

## Copy a database URL

1. Open the database as a full page in Notion.
2. Click `Share` or the `...` database menu.
3. Click `Copy link`.
4. Use that full URL:

```bash
node scripts/notion-tickets.ts list --source "https://www.notion.so/workspace/Tickets-248104cd477e80fdb757e945d38000bd?v=148104cd477e80bb928f000ce197ddf2"
```

The script extracts the database ID from the URL, retrieves the database container, and then queries its data source.

## Copy a data source ID directly

Use this when a database has multiple data sources or when you want to avoid ambiguity.

1. Open the database as a full page.
2. Open database settings.
3. Go to `Manage data sources`.
4. Open the `...` menu for the target data source.
5. Click `Copy data source ID`.
6. Use either:

```bash
node scripts/notion-tickets.ts list --data-source-id "<data-source-id>"
```

or:

```bash
node scripts/notion-tickets.ts list --source "<data-source-id>"
```

## Extract IDs from URLs manually

Notion URLs usually contain a 32-character hexadecimal ID, optionally with dashes. Examples:

```text
https://www.notion.so/workspace/Tickets-248104cd477e80fdb757e945d38000bd?v=...
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

The ID above becomes:

```text
248104cd-477e-80fd-b757-e945d38000bd
```

The script does this extraction automatically, so prefer passing the whole URL.

## Which source should I prefer?

Best options, in order:

1. `--data-source-id <id>` when you know it.
2. Database URL when the ticket database is a normal full-page database.
3. Page URL when the page contains a single child ticket database.

Avoid copied links to linked database views if possible; use the original/source database page or the exact data source ID.
