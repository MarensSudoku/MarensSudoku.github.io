import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { parseByteRange } from '../web/range.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 4175);
const mime = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.webmanifest':'application/manifest+json', '.txt':'text/plain; charset=utf-8', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.m4a':'audio/mp4', '.mp4':'video/mp4' };
mime['.glb'] = 'model/gltf-binary';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    const location = relative(root, path);
    if (location === '..' || location.startsWith('..' + sep) || location.includes(':')) { res.writeHead(403).end(); return; }
    const file = (await stat(path)).isDirectory() ? resolve(path, 'index.html') : path;
    const content = await readFile(file);
    const headers = { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'Content-Length':content.length, 'Accept-Ranges':'bytes' };
    const range = !req.headers['if-range'] ? parseByteRange(req.headers.range, content.length) : undefined;
    if (range === null) { res.writeHead(416, { ...headers, 'Content-Range':`bytes */${content.length}`, 'Content-Length':0 }).end(); return; }
    if (range) {
      res.writeHead(206, { ...headers, 'Content-Range':`bytes ${range.start}-${range.end}/${content.length}`, 'Content-Length':range.end - range.start + 1 });
      res.end(req.method === 'HEAD' ? undefined : content.subarray(range.start, range.end + 1)); return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end(); else res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/`));
