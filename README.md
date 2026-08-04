# @pipeworx/permid

PermID MCP — Refinitiv / LSEG Permanent Identifier. Free with API key (5,000 req/day).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `search_entities(query, entity_type?, limit?)` — search orgs/instruments/people/quotes.
- `get_entity(permid)` — full JSON-LD record by PermID.

## Auth

BYO only. Pass `?_apiKey=<token>` on the gateway URL. Register an LSEG account at https://permid.org/signin (free 5,000 req/day).

## Data source

`https://api-eit.refinitiv.com/permid/` — header `X-AG-Access-Token`.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "permid": {
      "url": "https://gateway.pipeworx.io/permid/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Permid data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
