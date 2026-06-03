# SOLARA TV — MCP Server

Model Context Protocol server that lets AI assistants (Claude Desktop, Cline, ChatGPT via MCP bridge, etc.) manage SOLARA TV subscriptions, look up devices, and read analytics.

## Tools exposed

| Tool | Purpose |
|---|---|
| `get_reseller_info` | Remaining API credits |
| `list_bouquets` | All IPTV packages |
| `create_m3u_subscription` | New M3U sub |
| `create_mag_subscription` | New MAG sub |
| `renew_m3u` / `renew_mag` | Renew existing |
| `lookup_device_m3u` / `lookup_device_mag` | Device info & expiry |
| `analytics_summary` | Page views (Supabase) |
| `list_recent_subscriptions` | History (Supabase) |

## Install

```powershell
cd mcp-server
npm install
```

## Run locally

```powershell
$env:ACTIVATION_API_KEY = "your_activation_panel_key"
$env:SUPABASE_URL = "https://xxxxx.supabase.co"           # optional
$env:SUPABASE_SERVICE_KEY = "service_role_key"            # optional, server-side only
npm start
```

## Hook into Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solaratv": {
      "command": "node",
      "args": ["C:\\Users\\PC-Amine\\Desktop\\sonaratv.tv\\mcp-server\\src\\index.js"],
      "env": {
        "ACTIVATION_API_KEY": "your_activation_panel_key",
        "SUPABASE_URL": "https://xxxxx.supabase.co",
        "SUPABASE_SERVICE_KEY": "service_role_key"
      }
    }
  }
}
```

Restart Claude Desktop. You can now ask:
- *"Create a 12-month M3U subscription with bouquet 12"*
- *"Look up MAG device 00:1A:79:11:22:33"*
- *"How many credits do I have left?"*
- *"Show top 10 pages last 7 days"*

## Hook into VS Code (Cline / Continue)

See https://modelcontextprotocol.io/docs/clients for editor integrations.

## Publish to npm (optional)

```powershell
npm login
npm publish --access public
```

Then anyone can run it via `npx solaratv-mcp`.

## Security

- **Never commit** `ACTIVATION_API_KEY` or `SUPABASE_SERVICE_KEY` to git.
- The MCP server runs **locally** on stdio — credentials stay on your machine.
- Service role key bypasses RLS — use only in trusted environments.
