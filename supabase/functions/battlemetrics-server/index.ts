import { z } from 'npm:zod';

import {
  battlemetricsFetch,
  normalizeServer,
  type BattlemetricsServerResource,
} from '../_shared/battlemetrics.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const paramsSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .min(1)
    .max(80),
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    id: url.searchParams.get('id'),
  });

  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_server_id', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await battlemetricsFetch(`/servers/${parsed.data.id}`);

  if (!result.ok) {
    return jsonResponse(
      {
        error: 'battlemetrics_error',
        status: result.status,
      },
      { status: result.status === 404 ? 404 : 502 },
    );
  }

  const body = result.body as { data: BattlemetricsServerResource };
  return jsonResponse({
    server: normalizeServer(body.data),
    source: 'battlemetrics',
  });
});
