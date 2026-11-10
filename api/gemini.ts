// Vercel serverless function: POST /api/gemini – proxy giữ GEMINI_API_KEY ở phía server
import { handleGemini } from '../server/handlers.js';

export async function POST(request: Request): Promise<Response> {
  const payload = await request.json().catch(() => null);
  const { status, body } = await handleGemini(process.env, payload, request.signal);
  return Response.json(body, { status });
}
