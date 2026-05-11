interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * PermID MCP — Refinitiv / LSEG Permanent Identifier (free, requires API key)
 *
 * PermIDs are open canonical identifiers for organizations, people, instruments,
 * currencies, industries, and quotes. ~6M organizations resolved across tickers,
 * RICs, ISINs, exchange listings.
 *
 * Auth: header X-AG-Access-Token. Free tier 5,000 req/day.
 * Register at https://permid.org/signin
 *
 * Tools:
 * - search_entities: search across orgs / people / instruments
 * - get_entity:      full record by PermID
 */


const BASE_URL = 'https://api-eit.refinitiv.com/permid';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_entities',
    description:
      'Search PermID for organizations, people, instruments, or quotes by name. Returns PermID, primary type, name, and a brief context. Use get_entity with the PermID for the full linked-data record.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search term' },
        entity_type: {
          type: 'string',
          description: 'Restrict by type',
          enum: ['organization', 'person', 'instrument', 'quote', 'all'],
        },
        limit: { type: 'number', description: '1-100 (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_entity',
    description:
      'Fetch the full PermID record by ID. For organizations: legal name, headquarters, identifiers (RIC, ISIN, ticker, LEI), industry codes, public/private status. For people: name, type, affiliations.',
    inputSchema: {
      type: 'object',
      properties: {
        permid: { type: 'string', description: 'PermID (numeric string, e.g., "4295905573")' },
      },
      required: ['permid'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'PermID requires an API key. Contact the operator about platform credentials, or pass ?_apiKey=<your_key> after registering at https://permid.org/signin (free).',
    );
  }
  switch (name) {
    case 'search_entities':
      return searchEntities(apiKey, args);
    case 'get_entity':
      return getEntity(apiKey, args.permid as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function permidFetch<T>(apiKey: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'X-AG-Access-Token': apiKey,
      Accept: 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`PermID: unauthorized (HTTP ${res.status}). Check the API key.`);
  }
  if (res.status === 429) {
    throw new Error('PermID: rate-limit hit (HTTP 429) — free tier is 5,000 req/day');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PermID error: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function searchEntities(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    q: String(args.query),
    format: 'json',
    'numOfMatchesPerEntityType': String(Math.min(100, Math.max(1, (args.limit as number) ?? 20))),
  });
  const entityType = (args.entity_type as string) ?? 'all';
  if (entityType && entityType !== 'all') params.set('entityType', entityType);

  const data = await permidFetch<{
    result?: {
      organizations?: { entities?: PermIdHit[] };
      instruments?: { entities?: PermIdHit[] };
      quotes?: { entities?: PermIdHit[] };
      people?: { entities?: PermIdHit[] };
    };
  }>(apiKey, `${BASE_URL}/search?${params}`);

  const buckets = data.result ?? {};
  return {
    organizations: (buckets.organizations?.entities ?? []).map(normalizeHit),
    instruments: (buckets.instruments?.entities ?? []).map(normalizeHit),
    quotes: (buckets.quotes?.entities ?? []).map(normalizeHit),
    people: (buckets.people?.entities ?? []).map(normalizeHit),
  };
}

interface PermIdHit {
  '@id'?: string;
  '@type'?: string;
  'organizationName'?: string;
  'instrumentName'?: string;
  'name'?: string;
  'hasURL'?: string;
  'country'?: string;
  'primaryRIC'?: string;
  'primaryTicker'?: string;
  'organizationStatusCode'?: string;
}

function normalizeHit(h: PermIdHit) {
  return {
    permid_url: h['@id'] ?? null,
    permid: h['@id']?.replace(/^https?:\/\/permid\.org\/(\d+).*$/, '$1') ?? null,
    type: h['@type'] ?? null,
    name: h.organizationName ?? h.instrumentName ?? h.name ?? null,
    primary_ric: h.primaryRIC ?? null,
    primary_ticker: h.primaryTicker ?? null,
    country: h.country ?? null,
    org_status: h.organizationStatusCode ?? null,
    homepage: h.hasURL ?? null,
  };
}

async function getEntity(apiKey: string, permid: string) {
  // PermID record endpoint returns JSON-LD; we surface the most useful fields.
  const url = `${BASE_URL}/1-${encodeURIComponent(permid)}?format=json-ld`;
  const data = await permidFetch<Record<string, unknown>>(apiKey, url);

  return {
    permid_url: `https://permid.org/1-${permid}`,
    permid,
    raw: data,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
