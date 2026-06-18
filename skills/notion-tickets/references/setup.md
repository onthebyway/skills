# Notion Tickets Setup

This skill reads tickets from a Notion page, database, or data source that you pass with `--source`.

## 1. Create a Notion token

Use either a Notion Personal Access Token (PAT) or an internal integration token. Both are bearer tokens and work the same way for this script.

### Personal Access Token / trusted local tool

1. Open Notion's developer portal: <https://www.notion.so/my-integrations>
2. Create a new integration or personal access token for your workspace.
3. Give it a recognizable name, for example `Agent Notion Tickets`.
4. Copy the generated token. Newer tokens commonly start with `ntn_`; older integration secrets may start with `secret_`.
5. Store it in your shell environment, not in git:

```bash
export NOTION_API_TOKEN="ntn_your_token_here"
```

The script also accepts `NOTION_API_KEY` or `NOTION_TOKEN` if those are already used in your environment.

### Required capabilities

For listing tickets:

- Read content

For fetching optional comments with `get --comments`:

- Read comments

No write/insert/update capability is needed for this read-only skill.

## 2. Share the Notion source with the connection

Creating a token does not automatically grant access to your workspace content.

For the page or database you want to query:

1. Open it in Notion.
2. Click the `...` menu in the top-right.
3. Find `Connections` / `Add connections` / `Connect to`.
4. Select the integration/PAT connection you created.
5. Confirm it has access.

If you skip this, Notion often returns `404 object_not_found` even when the page/database exists.

## 3. Choose what to pass as `--source`

You can pass any of these:

```bash
--source "https://www.notion.so/workspace/My-Tickets-248104cd477e80fdb757e945d38000bd?v=..."
--source "248104cd-477e-80fd-b757-e945d38000bd"
--source "https://www.notion.so/workspace/Page-With-Ticket-Database-11111111111111111111111111111111"
--source "<data-source-id>"
```

Resolution order:

1. Try the ID as a data source.
2. Try it as a database container and use its data source.
3. Try it as a page and discover child databases.

If a page/database has multiple candidate data sources, use:

```bash
--database-name "Tickets"
# or
--data-source-id "<exact-data-source-id>"
```

## 4. Verify access

From this skill directory:

```bash
node scripts/notion-tickets.ts inspect --source "$NOTION_SOURCE"
```

You should see the resolved data source ID and property schema.

Then list open tickets:

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE"
```

## 5. Configure schema defaults if needed

The script defaults to a status property named `Status`. For Notion `status` properties, it automatically excludes options in status groups named like `Complete`, `Done`, `Closed`, or `Archive`. It also tries these common completed names when they exist in the schema:

- Done
- Completed
- Closed
- Resolved
- Archived

Override per command:

```bash
node scripts/notion-tickets.ts list \
  --source "$NOTION_SOURCE" \
  --status-property "State" \
  --completed-status "Complete"
```

Or set environment defaults:

```bash
export NOTION_TICKETS_STATUS_PROPERTY="State"
export NOTION_TICKETS_TITLE_PROPERTY="Task"
export NOTION_TICKETS_COMPLETED_STATUSES="Done,Shipped,Cancelled"
```

## 6. Security notes

- Do not commit tokens to the repository.
- Prefer the least privileges needed: read content, and optionally read comments.
- If a token leaks, revoke/refresh it in Notion's integration settings.
