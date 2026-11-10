// Vercel serverless function: GET /api/youtube-search?q=...
import { handleYoutubeSearch } from '../server/handlers.js';

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const { status, body } = await handleYoutubeSearch(process.env, q);
  return Response.json(body, { status });
}
