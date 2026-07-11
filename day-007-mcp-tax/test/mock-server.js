#!/usr/bin/env node
'use strict';

const tools = [
  {
    name: 'invoice_lookup',
    description: 'Look up a fictional invoice by id for MCP tax testing.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice id to inspect.' },
      },
      required: ['invoiceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'schema_meter',
    description: 'Return a deterministic schema size sample.',
    inputSchema: {
      type: 'object',
      properties: {
        verbose: { type: 'boolean', description: 'Include verbose details.' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['verbose'],
      additionalProperties: false,
    },
  },
];

if (require.main === module) {
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) handleLine(line);
      newlineIndex = buffer.indexOf('\n');
    }
  });
}

function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (_error) {
    return;
  }

  if (message.method === 'initialize') {
    respond(message.id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mock-tax-server', version: '1.0.0' },
    });
    return;
  }

  if (message.method === 'notifications/initialized') {
    return;
  }

  if (message.method === 'tools/list') {
    if (message.params && message.params.cursor === 'page-2') {
      respond(message.id, { tools: [tools[1]] });
    } else {
      respond(message.id, { tools: [tools[0]], nextCursor: 'page-2' });
    }
    return;
  }

  if (message.id !== undefined) {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Unknown method: ${message.method}` },
    })}\n`);
  }
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

module.exports = { tools };
