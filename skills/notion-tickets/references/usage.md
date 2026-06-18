# Notion Tickets Usage

Run commands from `.agents/skills/notion-tickets/`:

```bash
cd .agents/skills/notion-tickets
```

Or use the full path from the repository root:

```bash
node .agents/skills/notion-tickets/scripts/notion-tickets.ts list --source "$NOTION_SOURCE"
```

## Inspect a source

Always start here for a new Notion source:

```bash
node scripts/notion-tickets.ts inspect --source "$NOTION_SOURCE"
```

Markdown output:

```bash
node scripts/notion-tickets.ts inspect --source "$NOTION_SOURCE" --format markdown
```

## List open tickets

Completed tickets are excluded by default.

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE"
```

For Notion `status` properties, completed statuses are detected from status groups named like `Complete`, `Done`, `Closed`, or `Archive`. Common completed names such as `Done`, `Completed`, `Closed`, `Resolved`, and `Archived` are also excluded when present in the schema.

## Filter by status

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --status "In Progress"
```

Multiple statuses:

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --status "Todo" \
  --status "Blocked"
```

If you request a completed status without `--all`, the script exits with a helpful error.

## Include completed tickets

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --all
```

Search a completed status intentionally:

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --status "Done" --all
```

## Pagination

First page:

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --page-size 20
```

The JSON output includes:

```json
{
  "pagination": {
    "has_more": true,
    "next_cursor": "..."
  }
}
```

Next page:

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --page-size 20 \
  --cursor "<next_cursor>"
```

Fetch every page:

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --all-pages
```

Use `--all-pages` sparingly for large databases because Notion rate limits API requests.

## Sorting

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --sort "Priority:descending" \
  --sort "Due:ascending"
```

Timestamp sorts:

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --sort "last_edited_time:descending"
```

## Non-standard schema

If the status property is not named `Status`:

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --status-property "State"
```

If completed statuses are custom:

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --completed-status "Shipped" \
  --completed-status "Cancelled"
```

## Fetch one ticket

Basic page metadata:

```bash
node scripts/notion-tickets.ts get "$TICKET_PAGE_URL_OR_ID"
```

Include body content blocks:

```bash
node scripts/notion-tickets.ts get "$TICKET_PAGE_URL_OR_ID" --content
```

Include open comments:

```bash
node scripts/notion-tickets.ts get "$TICKET_PAGE_URL_OR_ID" --comments
```

Markdown output:

```bash
node scripts/notion-tickets.ts get "$TICKET_PAGE_URL_OR_ID" --content --format markdown
```

## Troubleshooting

### 401 Unauthorized

The token is missing, invalid, or revoked.

Fix:

```bash
export NOTION_API_TOKEN="ntn_..."
```

### 403 Forbidden or 404 Object not found

The most common cause is that the page/database was not shared with the integration/PAT connection.

Fix:

1. Open the source in Notion.
2. Click `...`.
3. Add the integration under `Connections` / `Connect to`.
4. Re-run `inspect`.

### Multiple data sources or child databases

Use one of:

```bash
--database-name "Tickets"
--data-source-id "<id>"
```

### Status property not found

Run:

```bash
node scripts/notion-tickets.ts inspect --source "$NOTION_SOURCE"
```

Then pass the correct property name:

```bash
--status-property "State"
```

### Rate limited / 429

The script retries rate limits and transient server errors. If it still fails:

- Reduce `--page-size`.
- Avoid `--all-pages`.
- Wait and retry.
