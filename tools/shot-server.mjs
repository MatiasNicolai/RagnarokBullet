// Dev helper: receives canvas dataURLs via POST and writes PNG/JPEG files.
// Used to capture game screenshots when the preview tab is backgrounded.
// Usage: node tools/shot-server.mjs  ->  POST http://localhost:8123/<name>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const m = body.match(/^data:image\/(png|jpeg);base64,(.+)$/s);
    if (!m) { res.statusCode = 400; res.end('bad dataURL'); return; }
    const name = (req.url.slice(1) || 'shot').replace(/[^\w-]/g, '') || 'shot';
    const file = path.join(OUT, `${name}.${m[1] === 'jpeg' ? 'jpg' : 'png'}`);
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
    res.end(file);
  });
}).listen(8123, () => console.log('shot server on :8123'));
