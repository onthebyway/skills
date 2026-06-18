type Json = Record<string, any>;

type Args = {
  command?: string;
  positional: string[];
  source?: string;
  dataSourceId?: string;
  databaseName?: string;
  statusProperty: string;
  titleProperty?: string;
  statuses: string[];
  completedStatuses: string[];
  all: boolean;
  pageSize: number;
  cursor?: string;
  allPages: boolean;
  format: "json" | "markdown";
  sort: string[];
  content: boolean;
  comments: boolean;
  raw: boolean;
  help: boolean;
};

const NOTION_VERSION = process.env.NOTION_VERSION || "2026-03-11";
const DEFAULT_COMPLETED = ["Done", "Completed", "Closed", "Resolved", "Archived"];

function usage(exitCode = 0): never {
  const text = `Notion Tickets

Usage:
  node scripts/notion-tickets.ts inspect --source <url-or-id> [options]
  node scripts/notion-tickets.ts list --source <url-or-id> [options]
  node scripts/notion-tickets.ts get <ticket-page-url-or-id> [options]

Commands:
  inspect              Resolve a source and print the data source schema.
  list                 List tickets. Excludes completed statuses by default.
  get                  Fetch one ticket page.

Common options:
  --source <value>              Page/database/data-source URL or ID.
  --data-source-id <id>         Explicit data source ID; bypasses source resolution.
  --database-name <name>        Pick child database/data source by name when page source has multiple.
  --status-property <name>      Status/select property name. Default: Status.
  --title-property <name>       Title property name. Auto-detected by default.
  --format json|markdown        Output format. Default: json.

List options:
  --status <name>               Include only tickets with this status. Repeatable.
  --completed-status <name>     Completed status excluded by default. Repeatable.
  --all                         Include completed tickets.
  --page-size <1-100>           Page size. Default: 25.
  --cursor <cursor>             Notion start_cursor for next page.
  --all-pages                   Fetch all pages by following cursors.
  --sort <property:dir>         Sort, e.g. Priority:descending or Due:ascending. Repeatable.

Get options:
  --content                     Include page body blocks as markdown-ish text.
  --comments                    Include open comments.
  --raw                         Include raw Notion response objects.

Environment:
  NOTION_API_TOKEN, NOTION_API_KEY, or NOTION_TOKEN must be set.
  Optional defaults: NOTION_TICKETS_STATUS_PROPERTY, NOTION_TICKETS_TITLE_PROPERTY,
  NOTION_TICKETS_COMPLETED_STATUSES, NOTION_VERSION.
`;
  console.log(text);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0],
    positional: [],
    statusProperty: process.env.NOTION_TICKETS_STATUS_PROPERTY || "Status",
    titleProperty: process.env.NOTION_TICKETS_TITLE_PROPERTY,
    statuses: [],
    completedStatuses: (process.env.NOTION_TICKETS_COMPLETED_STATUSES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    all: false,
    pageSize: 25,
    allPages: false,
    format: "json",
    sort: [],
    content: false,
    comments: false,
    raw: false,
    help: false,
  };
  if (!args.completedStatuses.length) args.completedStatuses = [...DEFAULT_COMPLETED];
  if (argv[0] === "--help" || argv[0] === "-h") args.help = true;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h":
      case "--help": args.help = true; break;
      case "--source": args.source = next(); break;
      case "--data-source-id": args.dataSourceId = normalizeId(next()); break;
      case "--database-name": args.databaseName = next(); break;
      case "--status-property": args.statusProperty = next(); break;
      case "--title-property": args.titleProperty = next(); break;
      case "--status": args.statuses.push(next()); break;
      case "--completed-status": args.completedStatuses.push(next()); break;
      case "--all":
      case "--include-completed": args.all = true; break;
      case "--page-size": args.pageSize = Math.max(1, Math.min(100, Number(next()))); break;
      case "--cursor": args.cursor = next(); break;
      case "--all-pages": args.allPages = true; break;
      case "--format": {
        const v = next();
        if (v !== "json" && v !== "markdown") throw new Error("--format must be json or markdown");
        args.format = v;
        break;
      }
      case "--sort": args.sort.push(next()); break;
      case "--content": args.content = true; break;
      case "--comments": args.comments = true; break;
      case "--raw": args.raw = true; break;
      default:
        if (a.startsWith("--")) throw new Error(`Unknown option: ${a}`);
        args.positional.push(a);
    }
  }
  return args;
}

function getToken(): string {
  const token = process.env.NOTION_API_TOKEN || process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
  if (!token) throw new Error("Missing Notion token. Set NOTION_API_TOKEN, NOTION_API_KEY, or NOTION_TOKEN.");
  return token;
}

function normalizeId(value: string): string {
  const raw = value.trim();
  const noQuery = raw.split(/[?#]/)[0] || raw;
  const matches = [...noQuery.matchAll(/[0-9a-fA-F]{32}/g)];
  if (matches.length) return uuid(matches[matches.length - 1][0]);
  const dashed = raw.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (dashed) return dashed[0].toLowerCase();
  return raw;
}

function uuid(id: string): string {
  const s = id.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(s)) return id;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function notion(path: string, options: { method?: string; body?: Json; query?: Json } = {}): Promise<Json> {
  const token = getToken();
  const url = new URL(`https://api.notion.com/v1/${path.replace(/^\/v1\//, "").replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(options.query || {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const hasBody = Boolean(options.body && Object.keys(options.body).length);
  const method = options.method || (hasBody ? "POST" : "GET");
  const requestBody = method === "GET" || !hasBody ? undefined : JSON.stringify(options.body);
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const waitMs = retryAfter ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const hint = res.status === 401
        ? "Check your NOTION_API_TOKEN."
        : res.status === 403 || res.status === 404
          ? "Check that the target page/database is shared with your Notion integration/PAT connection and that the ID is correct."
          : res.status === 429
            ? "Rate limited. Retry later or reduce --all-pages usage."
            : "See Notion error response.";
      throw new Error(`Notion API ${res.status} ${data.code || "error"}: ${data.message || text}\nHint: ${hint}`);
    }
    return data;
  }
  throw new Error("Notion request failed after retries");
}

async function paginate(path: string, body: Json = {}, options: { method?: string; query?: Json; allPages?: boolean } = {}) {
  const results: any[] = [];
  const method = options.method || "POST";
  let cursor = body.start_cursor || options.query?.start_cursor;
  let last: Json | undefined;
  do {
    const pageBody = method === "GET" ? {} : { ...body, ...(cursor ? { start_cursor: cursor } : {}) };
    const query = method === "GET" ? { ...(options.query || {}), ...(cursor ? { start_cursor: cursor } : {}) } : options.query;
    last = await notion(path, { method, body: pageBody, query });
    results.push(...(last.results || []));
    cursor = last.next_cursor;
  } while (options.allPages && last?.has_more && cursor);
  return { ...last, results };
}

function richTextPlain(arr: any[] = []): string {
  return arr.map((r) => r.plain_text ?? r.text?.content ?? "").join("");
}

function titleOfDatabase(db: Json): string {
  return richTextPlain(db.title || []) || db.id;
}

async function resolveSource(args: Args): Promise<{ database?: Json; dataSource: Json; sourceKind: string }> {
  if (args.dataSourceId) {
    const dataSource = await notion(`data_sources/${args.dataSourceId}`);
    return { dataSource, sourceKind: "explicit-data-source" };
  }
  if (!args.source) throw new Error("Missing --source <Notion page/database/data-source URL or ID>.");
  const id = normalizeId(args.source);

  // Try as data source first.
  try {
    const dataSource = await notion(`data_sources/${id}`);
    return { dataSource, sourceKind: "data-source" };
  } catch (e: any) {
    if (!String(e.message).includes("404") && !String(e.message).includes("400")) throw e;
  }

  // Try as database container.
  try {
    const database = await notion(`databases/${id}`);
    const sources = database.data_sources || [];
    if (!sources.length) throw new Error(`Database ${id} has no data_sources.`);
    const chosen = chooseNamed(sources, args.databaseName, "data source");
    const dataSource = await notion(`data_sources/${chosen.id}`);
    return { database, dataSource, sourceKind: "database" };
  } catch (e: any) {
    if (!String(e.message).includes("404") && !String(e.message).includes("400")) throw e;
  }

  // Try as page: discover child databases.
  const children = await paginate(`blocks/${id}/children`, {}, { method: "GET", allPages: true });
  const childDbs = (children.results || []).filter((b: Json) => b.type === "child_database");
  if (!childDbs.length) {
    throw new Error(`Source resolved as page ${id}, but no child databases were found. Pass a database/data-source URL or --data-source-id.`);
  }
  const chosenBlock = chooseNamed(
    childDbs.map((b: Json) => ({ id: b.id, name: b.child_database?.title || b.id })),
    args.databaseName,
    "child database"
  );
  const database = await notion(`databases/${chosenBlock.id}`);
  const sources = database.data_sources || [];
  const chosenSource = chooseNamed(sources, args.databaseName, "data source");
  const dataSource = await notion(`data_sources/${chosenSource.id}`);
  return { database, dataSource, sourceKind: "page-child-database" };
}

function chooseNamed(items: any[], name: string | undefined, label: string) {
  if (name) {
    const found = items.find((i) => (i.name || i.title || "").toLowerCase() === name.toLowerCase());
    if (!found) throw new Error(`No ${label} named "${name}". Available: ${items.map((i) => i.name || i.title || i.id).join(", ")}`);
    return found;
  }
  if (items.length === 1) return items[0];
  throw new Error(`Multiple ${label}s found. Re-run with --database-name <name> or --data-source-id <id>. Available: ${items.map((i) => `${i.name || i.title || i.id} (${i.id})`).join(", ")}`);
}

function findTitleProperty(schema: Json, preferred?: string): string | undefined {
  const props = schema.properties || {};
  if (preferred && props[preferred]) return preferred;
  return Object.entries(props).find(([, p]: any) => p.type === "title")?.[0];
}

function getPropertyValue(prop: Json): any {
  if (!prop) return undefined;
  switch (prop.type) {
    case "title": return richTextPlain(prop.title);
    case "rich_text": return richTextPlain(prop.rich_text);
    case "status": return prop.status?.name;
    case "select": return prop.select?.name;
    case "multi_select": return (prop.multi_select || []).map((x: Json) => x.name);
    case "people": return (prop.people || []).map((p: Json) => p.name || p.id);
    case "date": return prop.date;
    case "checkbox": return prop.checkbox;
    case "number": return prop.number;
    case "url": return prop.url;
    case "email": return prop.email;
    case "phone_number": return prop.phone_number;
    case "formula": return prop.formula?.[prop.formula.type];
    case "relation": return (prop.relation || []).map((r: Json) => r.id);
    default: return prop[prop.type] ?? prop;
  }
}

function normalizePage(page: Json, schema?: Json, args?: Args): Json {
  const titleProp = findTitleProperty(schema || { properties: page.properties || {} }, args?.titleProperty);
  const statusProp = args?.statusProperty || process.env.NOTION_TICKETS_STATUS_PROPERTY || "Status";
  const props: Json = {};
  for (const [name, value] of Object.entries(page.properties || {})) props[name] = getPropertyValue(value as Json);
  return {
    id: page.id,
    url: page.url,
    title: titleProp ? props[titleProp] : undefined,
    status: props[statusProp],
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    archived: page.archived,
    in_trash: page.in_trash,
    properties: props,
  };
}

function completedStatusesFor(schema: Json, args: Args): string[] {
  const prop = schema.properties?.[args.statusProperty];
  const names = new Set(args.completedStatuses);
  const optionNames = prop ? new Set(((prop[prop.type]?.options || []) as Json[]).map((o: Json) => String(o.name))) : undefined;
  if (prop?.type === "status") {
    const optionsById = new Map((prop.status?.options || []).map((o: Json) => [o.id, o.name]));
    const completeGroups = (prop.status?.groups || []).filter((g: Json) => /complete|done|closed|archive/i.test(g.name || ""));
    for (const group of completeGroups) {
      for (const optionId of group.option_ids || []) {
        const optionName = optionsById.get(optionId);
        if (optionName) names.add(String(optionName));
      }
    }
  }
  const list = [...names];
  return optionNames?.size ? list.filter((name) => optionNames.has(name)) : list;
}

function buildFilter(schema: Json, args: Args): Json | undefined {
  const prop = schema.properties?.[args.statusProperty];
  if (!prop) throw new Error(`Status property "${args.statusProperty}" not found. Run inspect to see available properties or pass --status-property.`);
  if (prop.type !== "status" && prop.type !== "select") throw new Error(`Status property "${args.statusProperty}" is type ${prop.type}; expected status or select.`);
  const type = prop.type;
  const completedStatuses = completedStatusesFor(schema, args);
  const completedSet = new Set(completedStatuses.map((s) => s.toLowerCase()));
  const completedRequested = args.statuses.filter((s) => completedSet.has(s.toLowerCase()));
  if (completedRequested.length && !args.all) {
    throw new Error(`Status ${completedRequested.map((s) => `"${s}"`).join(", ")} is configured as completed. Use --all to include completed tickets.`);
  }

  const clauses: Json[] = [];
  if (args.statuses.length === 1) {
    clauses.push({ property: args.statusProperty, [type]: { equals: args.statuses[0] } });
  } else if (args.statuses.length > 1) {
    clauses.push({ or: args.statuses.map((s) => ({ property: args.statusProperty, [type]: { equals: s } })) });
  }
  if (!args.all) {
    for (const s of completedStatuses) {
      clauses.push({ property: args.statusProperty, [type]: { does_not_equal: s } });
    }
  }
  if (!clauses.length) return undefined;
  return clauses.length === 1 ? clauses[0] : { and: clauses };
}

function buildSorts(args: Args): Json[] | undefined {
  if (!args.sort.length) return undefined;
  return args.sort.map((s) => {
    const [name, dirRaw = "ascending"] = s.split(":");
    const direction = dirRaw.toLowerCase().startsWith("desc") ? "descending" : "ascending";
    if (name === "created_time" || name === "last_edited_time") return { timestamp: name, direction };
    return { property: name, direction };
  });
}

async function inspect(args: Args) {
  const resolved = await resolveSource(args);
  const properties = Object.entries(resolved.dataSource.properties || {}).map(([name, p]: any) => ({
    name,
    id: p.id,
    type: p.type,
    options: p[p.type]?.options?.map((o: Json) => o.name),
    groups: p[p.type]?.groups?.map((g: Json) => ({ name: g.name, option_ids: g.option_ids })),
  }));
  const out = {
    source_kind: resolved.sourceKind,
    database: resolved.database ? { id: resolved.database.id, title: titleOfDatabase(resolved.database), data_sources: resolved.database.data_sources } : undefined,
    data_source: { id: resolved.dataSource.id, title: richTextPlain(resolved.dataSource.title || []) || resolved.dataSource.name, parent: resolved.dataSource.parent },
    detected: {
      title_property: findTitleProperty(resolved.dataSource, args.titleProperty),
      status_property: resolved.dataSource.properties?.[args.statusProperty] ? args.statusProperty : undefined,
      status_property_type: resolved.dataSource.properties?.[args.statusProperty]?.type,
      completed_statuses: completedStatusesFor(resolved.dataSource, args),
    },
    properties,
  };
  print(out, args);
}

async function list(args: Args) {
  const resolved = await resolveSource(args);
  const filter = buildFilter(resolved.dataSource, args);
  const sorts = buildSorts(args);
  const body: Json = { page_size: args.pageSize };
  if (args.cursor) body.start_cursor = args.cursor;
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;
  const response = await paginate(`data_sources/${resolved.dataSource.id}/query`, body, { method: "POST", allPages: args.allPages });
  const tickets = (response.results || []).map((p: Json) => normalizePage(p, resolved.dataSource, args));
  const out = {
    source: { kind: resolved.sourceKind, data_source_id: resolved.dataSource.id, database_id: resolved.database?.id },
    query: { filter, sorts, page_size: args.pageSize, included_completed: args.all, completed_statuses: completedStatusesFor(resolved.dataSource, args) },
    pagination: { has_more: Boolean(response.has_more), next_cursor: response.next_cursor || null },
    count: tickets.length,
    tickets,
    raw: args.raw ? response : undefined,
  };
  print(out, args);
}

async function getTicket(args: Args) {
  const id = normalizeId(args.positional[0] || "");
  if (!id) throw new Error("Missing ticket page URL or ID for get command.");
  const page = await notion(`pages/${id}`);
  const ticket = normalizePage(page, undefined, args);
  const out: Json = { ticket, raw: args.raw ? page : undefined };
  if (args.content) out.content = await getBlockMarkdown(id);
  if (args.comments) out.comments = (await paginate("comments", {}, { method: "GET", query: { block_id: id, page_size: 100 }, allPages: true })).results;
  print(out, args);
}

async function getBlockMarkdown(blockId: string, depth = 0): Promise<string> {
  const blocks = await paginate(`blocks/${blockId}/children`, {}, { method: "GET", query: { page_size: 100 }, allPages: true });
  const lines: string[] = [];
  for (const b of blocks.results || []) {
    const indent = "  ".repeat(depth);
    const t = b.type;
    const v = b[t] || {};
    const text = richTextPlain(v.rich_text || v.caption || []);
    if (t === "heading_1") lines.push(`# ${text}`);
    else if (t === "heading_2") lines.push(`## ${text}`);
    else if (t === "heading_3") lines.push(`### ${text}`);
    else if (t === "bulleted_list_item") lines.push(`${indent}- ${text}`);
    else if (t === "numbered_list_item") lines.push(`${indent}1. ${text}`);
    else if (t === "to_do") lines.push(`${indent}- [${v.checked ? "x" : " "}] ${text}`);
    else if (t === "quote") lines.push(`> ${text}`);
    else if (t === "code") lines.push(`\n\`\`\`${v.language || ""}\n${richTextPlain(v.rich_text || [])}\n\`\`\``);
    else if (text) lines.push(`${indent}${text}`);
    if (b.has_children && depth < 5) lines.push(await getBlockMarkdown(b.id, depth + 1));
  }
  return lines.filter(Boolean).join("\n");
}

function print(out: Json, args: Args) {
  if (args.format === "json") {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (out.tickets) {
    console.log(`# Notion tickets (${out.count})\n`);
    for (const t of out.tickets) console.log(`- ${t.status ? `[${t.status}] ` : ""}${t.title || t.id} — ${t.url || t.id}`);
    console.log(`\nNext cursor: ${out.pagination?.next_cursor || "<none>"}`);
    return;
  }
  if (out.properties) {
    console.log(`# Notion ticket source\n\nData source: ${out.data_source?.id}\n`);
    for (const p of out.properties) console.log(`- ${p.name}: ${p.type}${p.options ? ` (${p.options.join(", ")})` : ""}`);
    return;
  }
  if (out.ticket) {
    console.log(`# ${out.ticket.title || out.ticket.id}\n\nStatus: ${out.ticket.status || ""}\nURL: ${out.ticket.url || ""}\n`);
    if (out.content) console.log(out.content);
    return;
  }
  console.log(JSON.stringify(out, null, 2));
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.command || args.help) usage(0);
    if (!["inspect", "list", "get"].includes(args.command)) usage(1);
    if (args.command === "inspect") await inspect(args);
    if (args.command === "list") await list(args);
    if (args.command === "get") await getTicket(args);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

await main();
