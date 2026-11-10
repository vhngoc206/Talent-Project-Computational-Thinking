// Vercel serverless function: GET /api/config
import { handleConfig } from '../server/handlers.js';

export function GET(): Response {
  const { status, body } = handleConfig(process.env);
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
