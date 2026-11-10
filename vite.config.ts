import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleConfig, handleGemini, handleYoutubeSearch, type HandlerResult, type ServerEnv } from './server/handlers';

/**
 * Khi chạy `npm run dev` / `npm run preview`: gắn các API /api/* vào server của Vite
 * (giống hệt các serverless function trong thư mục api/ khi deploy lên Vercel).
 * API key chỉ nằm ở phía server – KHÔNG được đưa vào bundle của trình duyệt.
 */
function localApi(env: ServerEnv): Plugin {
  const send = (res: ServerResponse, { status, body }: HandlerResult) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  const readJson = (req: IncomingMessage) =>
    new Promise<unknown>((resolve) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(null);
        }
      });
    });

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/api/config') return send(res, handleConfig(env));
    if (url.pathname === '/api/gemini' && req.method === 'POST') return send(res, await handleGemini(env, await readJson(req)));
    if (url.pathname === '/api/youtube-search') return send(res, await handleYoutubeSearch(env, url.searchParams.get('q') ?? ''));
    next();
  };

  return {
    name: 'smartstudy-local-api',
    configureServer: (server) => void server.middlewares.use((req, res, next) => void middleware(req, res, next)),
    configurePreviewServer: (server) => void server.middlewares.use((req, res, next) => void middleware(req, res, next)),
  };
}

export default defineConfig(({ mode }) => {
  // Đọc .env cho phía server (prefix '' = mọi biến). Chỉ biến VITE_ mới vào bundle trình duyệt.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), localApi(env)],
  };
});
