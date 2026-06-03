#!/usr/bin/env node
/**
 * SOLARA TV — MCP server
 * Exposes IPTV management tools to AI assistants (Claude Desktop, ChatGPT, etc.)
 *
 * Env vars required:
 *   ACTIVATION_API_KEY   — Activation Panel API key
 *   SUPABASE_URL         — (optional) Supabase project URL
 *   SUPABASE_SERVICE_KEY — (optional) Supabase service role key (server-side only)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';

const ACTIVATION_API = 'https://activationpanel.net/api/api.php';
const API_KEY = process.env.ACTIVATION_API_KEY;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// --- Activation Panel API helper ---
async function callActivationApi(params) {
  if (!API_KEY) throw new Error('ACTIVATION_API_KEY env var is required');
  const url = new URL(ACTIVATION_API);
  url.searchParams.set('api_key', API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  return res.json();
}

// --- Tool definitions ---
const TOOLS = [
  {
    name: 'get_reseller_info',
    description: 'Get reseller info (remaining API credits, username).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_bouquets',
    description: 'List all available IPTV bouquets (channel packages).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'create_m3u_subscription',
    description: 'Create a new M3U IPTV subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: { type: 'number', description: 'Subscription package ID (1=1m, 3=3m, 6=6m, 12=12m)' },
        country: { type: 'string', description: 'Country code, e.g. FR, UK, US' },
        bouquet_ids: { type: 'string', description: 'Comma-separated bouquet IDs' },
        notes: { type: 'string' }
      },
      required: ['package_id', 'bouquet_ids']
    }
  },
  {
    name: 'create_mag_subscription',
    description: 'Create a new MAG box IPTV subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: { type: 'number' },
        mac: { type: 'string', description: 'MAC address (format 00:1A:79:XX:XX:XX)' },
        bouquet_ids: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['package_id', 'mac', 'bouquet_ids']
    }
  },
  {
    name: 'renew_m3u',
    description: 'Renew an existing M3U subscription by username.',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: { type: 'number' },
        username: { type: 'string' }
      },
      required: ['package_id', 'username']
    }
  },
  {
    name: 'renew_mag',
    description: 'Renew an existing MAG subscription by MAC.',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: { type: 'number' },
        mac: { type: 'string' }
      },
      required: ['package_id', 'mac']
    }
  },
  {
    name: 'lookup_device_m3u',
    description: 'Look up M3U device info by username and password.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' }
      },
      required: ['username', 'password']
    }
  },
  {
    name: 'lookup_device_mag',
    description: 'Look up MAG device info by MAC address.',
    inputSchema: {
      type: 'object',
      properties: {
        mac: { type: 'string' }
      },
      required: ['mac']
    }
  },
  {
    name: 'analytics_summary',
    description: 'Get page-view summary from Supabase (requires SUPABASE_* env vars).',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', default: 7 }
      }
    }
  },
  {
    name: 'list_recent_subscriptions',
    description: 'List recent subscriptions stored in Supabase.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20 }
      }
    }
  }
];

// --- Tool handlers ---
async function handleTool(name, args) {
  switch (name) {
    case 'get_reseller_info':
      return callActivationApi({ action: 'reseller' });

    case 'list_bouquets':
      return callActivationApi({ action: 'bouquets' });

    case 'create_m3u_subscription':
      return callActivationApi({
        action: 'new', type: 'm3u',
        package_id: args.package_id,
        country: args.country || '',
        bouquet_ids: args.bouquet_ids,
        notes: args.notes || ''
      });

    case 'create_mag_subscription':
      return callActivationApi({
        action: 'new', type: 'mag',
        package_id: args.package_id,
        mac: args.mac,
        bouquet_ids: args.bouquet_ids,
        notes: args.notes || ''
      });

    case 'renew_m3u':
      return callActivationApi({
        action: 'renew', type: 'm3u',
        package_id: args.package_id,
        username: args.username
      });

    case 'renew_mag':
      return callActivationApi({
        action: 'renew', type: 'mag',
        package_id: args.package_id,
        mac: args.mac
      });

    case 'lookup_device_m3u':
      return callActivationApi({
        action: 'info', type: 'm3u',
        username: args.username,
        password: args.password
      });

    case 'lookup_device_mag':
      return callActivationApi({
        action: 'info', type: 'mag',
        mac: args.mac
      });

    case 'analytics_summary': {
      if (!supabase) throw new Error('Supabase not configured');
      const days = args.days || 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from('page_views').select('page').gte('viewed_at', since);
      if (error) throw error;
      const counts = {};
      for (const r of data) counts[r.page] = (counts[r.page] || 0) + 1;
      return {
        days, total: data.length,
        top_pages: Object.entries(counts)
          .sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([page, count]) => ({ page, count }))
      };
    }

    case 'list_recent_subscriptions': {
      if (!supabase) throw new Error('Supabase not configured');
      const { data, error } = await supabase
        .from('subscriptions').select('*')
        .order('created_at', { ascending: false })
        .limit(args.limit || 20);
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Resources (read-only documentation) ---
const RESOURCES = [
  {
    uri: 'solaratv://docs/pricing',
    name: 'SOLARA TV pricing plans',
    mimeType: 'text/plain'
  },
  {
    uri: 'solaratv://docs/devices',
    name: 'Supported devices',
    mimeType: 'text/plain'
  }
];

function readResource(uri) {
  if (uri === 'solaratv://docs/pricing') {
    return 'SOLARA TV plans:\n- 1 month: €16\n- 3 months: €32\n- 6 months: €52\n- 12 months: €76.99\nContact: WhatsApp +212 600 160 196';
  }
  if (uri === 'solaratv://docs/devices') {
    return 'Supported: Firestick, Android TV, Smart TV (Samsung/LG/Sony), iOS, MAG, Enigma2, Formuler, STB Emu, IPTV Smarters, TiviMate.';
  }
  throw new Error(`Unknown resource: ${uri}`);
}

// --- Server setup ---
const server = new Server(
  { name: 'solaratv-mcp', version: '0.1.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await handleTool(req.params.name, req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => ({
  contents: [{ uri: req.params.uri, mimeType: 'text/plain', text: readResource(req.params.uri) }]
}));

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('SOLARA TV MCP server running on stdio');
