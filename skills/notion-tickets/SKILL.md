---
name: notion-tickets
description: Fetch and inspect tickets from a user-provided Notion page, database, data source, or URL. Use when the user asks to list, filter, paginate, or retrieve Notion tickets/tasks from a specific Notion resource.
---

# Notion Tickets

Fetch tickets from a Notion source passed at runtime. The source may be a Notion page URL/ID, database URL/ID, or data source ID.

## Setup

Before using this skill, read `references/setup.md` if credentials are not already available. Read `references/source-ids.md` if the user needs help finding a page/database/data-source URL or ID. See `references/usage.md` for examples and troubleshooting.

Required environment variable, any one of:

```bash
export NOTION_API_TOKEN="ntn_..."
# or NOTION_API_KEY / NOTION_TOKEN
```

The target Notion page/database must be shared with the token's connection.

## Commands

Run from this skill directory or use the full script path:

```bash
node scripts/notion-tickets.ts inspect --source "<notion-url-or-id>"
node scripts/notion-tickets.ts list --source "<notion-url-or-id>"
node scripts/notion-tickets.ts get "<ticket-page-url-or-id>"
```

### List tickets

By default, completed tickets are excluded.

```bash
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE"
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --status "In Progress"
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --all
node scripts/notion-tickets.ts list --source "$NOTION_SOURCE" --page-size 25 --cursor "$NEXT_CURSOR"
```

Important flags:

- `--source <url-or-id>`: Notion page/database/data-source source to pull tickets from.
- `--status <name>`: Filter by status. Repeat for multiple statuses.
- `--status-property <name>`: Status property name, default `Status`.
- `--completed-status <name>`: Completed status to exclude by default. Repeatable. Defaults: `Done`, `Completed`, `Closed`, `Resolved`, `Archived`.
- `--all`: Include completed tickets.
- `--page-size <1-100>` and `--cursor <cursor>`: Exposed Notion pagination.
- `--all-pages`: Fetch every page; use sparingly.
- `--format json|markdown`: Output format, default JSON.

### Inspect schema

```bash
node scripts/notion-tickets.ts inspect --source "$NOTION_SOURCE"
```

Use this to discover property names/types and confirm the source resolves correctly.

### Fetch one ticket

```bash
node scripts/notion-tickets.ts get "$TICKET_URL_OR_ID" --content --comments
```

## Notes

- Prefer current Notion data source APIs (`/v1/data_sources/{id}/query`).
- If a page source contains multiple child databases, pass `--data-source-id` or `--database-name` to disambiguate.
- 401 means missing/bad token. 403/404 often means the Notion resource was not shared with the integration.
- See `references/usage.md` for examples and troubleshooting.
