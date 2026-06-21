import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'web-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'terminal'), { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js', 'nodus-sdk.js']) fs.copyFileSync(path.join(root, 'desktop', file), path.join(out, file));
for (const file of ['index.html', 'styles.css', 'renderer.js']) fs.copyFileSync(path.join(root, 'terminal', file), path.join(out, 'terminal', file));
for (const dir of ['web', 'src']) fs.cpSync(path.join(root, 'terminal', dir), path.join(out, 'terminal', dir), { recursive: true });
fs.cpSync(path.join(root, 'web-api'), path.join(out, 'api'), { recursive: true });

fs.writeFileSync(path.join(out, 'config.js'), `window.__LUNIX=${JSON.stringify({
  nodusUrl: process.env.NODUS_URL || 'https://nodus-api-production-d291.up.railway.app',
  nodusUser: process.env.NODUS_USER || 'lunix-aaron-local',
  terminalUrl: '/terminal/?theme=sand&embed=1',
  browserRelayUrl: process.env.BROWSER_RELAY_URL || 'wss://lunix-browser-relay.yuanbopang.workers.dev',
})};\n`);
const indexPath = path.join(out, 'index.html');
const version = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, 'app.js'))).digest('hex').slice(0, 12);
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace('./app.js', `./app.js?v=${version}`).replace('./nodus-sdk.js', `./nodus-sdk.js?v=${version}`));
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify({ cleanUrls: true, trailingSlash: false, headers: [{ source: '/', headers: [{ key: 'Cache-Control', value: 'no-store' }] }] }, null, 2));
console.log(`web build → ${out}`);
