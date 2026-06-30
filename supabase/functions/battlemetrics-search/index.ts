import { z } from 'npm:zod';

import {
  battlemetricsFetch,
  normalizeServer,
  type BattlemetricsListResponse,
} from '../_shared/battlemetrics.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const querySchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    query: url.searchParams.get('query'),
    limit: url.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_query', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    'filter[game]': 'rust',
    'filter[search]': parsed.data.query,
    'page[size]': String(parsed.data.limit),
    sort: '-players',
  });

  const result = await battlemetricsFetch(`/servers?${params.toString()}`);

  if (!result.ok) {
    return jsonResponse(
      {
        error: 'battlemetrics_error',
        status: result.status,
      },
      { status: result.status === 429 ? 429 : 502 },
    );
  }

  const body = result.body as BattlemetricsListResponse;
  return jsonResponse({
    servers: body.data.map(normalizeServer),
    source: 'battlemetrics',
  });
});
