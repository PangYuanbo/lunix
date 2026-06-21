import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
execFileSync('npm', ['run', 'build', '-w', '@lunix/terminal'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['run', 'build:assistant', '-w', '@lunix/desktop'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['run', 'build:cloud', '-w', '@lunix/desktop'], { cwd: root, stdio: 'inherit' });
const out = path.join(root, 'web-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'app', 'terminal'), { recursive: true });

for (const file of ['index.html', 'styles.css', 'content-first.css', 'app.js', 'nodus-sdk.js']) {
  const source = path.join(root, 'desktop', file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, 'app', file));
}
for (const file of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, 'terminal', file), path.join(out, 'app', 'terminal', file));
for (const dir of ['web', 'dist']) fs.cpSync(path.join(root, 'terminal', dir), path.join(out, 'app', 'terminal', dir), { recursive: true });
fs.cpSync(path.join(root, 'desktop', 'assistant-dist'), path.join(out, 'app', 'assistant'), { recursive: true });
const terminalIndex = path.join(out, 'app', 'terminal', 'index.html');
fs.writeFileSync(terminalIndex, fs.readFileSync(terminalIndex, 'utf8').replace('<head>', '<head>\n  <base href="/app/terminal/">'));
fs.cpSync(path.join(root, 'web-api'), path.join(out, 'api'), { recursive: true });
fs.cpSync(path.join(root, 'desktop', 'cloud-browser', 'assets'), path.join(out, 'assets'), { recursive: true });
fs.cpSync(path.join(root, 'desktop', 'cloud-browser', 'media'), path.join(out, 'media'), { recursive: true });
fs.copyFileSync(path.join(root, 'desktop', 'cloud-browser', 'favicon.svg'), path.join(out, 'favicon.svg'));
fs.copyFileSync(path.join(root, 'desktop', 'cloud-browser', 'plan-b.html'), path.join(out, 'index.html'));

fs.writeFileSync(path.join(out, 'app', 'config.js'), `window.__LUNIX=${JSON.stringify({
  nodusUrl: process.env.NODUS_URL || 'https://nodus-api-production-d291.up.railway.app',
  nodusUser: process.env.NODUS_USER || 'lunix-aaron-local',
  terminalUrl: '/app/terminal/?theme=lunix&embed=1',
  browserRelayUrl: process.env.BROWSER_RELAY_URL || 'wss://lunix-browser-relay.yuanbopang.workers.dev',
})};\n`);
const indexPath = path.join(out, 'app', 'index.html');
const version = crypto.createHash('sha256').update(fs.readFileSync(path.join(out, 'app', 'app.js'))).digest('hex').slice(0, 12);
fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8')
  .replace('src="/config.js"', 'src="./config.js"')
  .replace('./app.js', `./app.js?v=${version}`)
  .replace('./nodus-sdk.js', `./nodus-sdk.js?v=${version}`));
fs.writeFileSync(path.join(out, 'vercel.json'), JSON.stringify({ cleanUrls: true, trailingSlash: true, headers: [{ source: '/', headers: [{ key: 'Cache-Control', value: 'no-store' }] }, { source: '/app/', headers: [{ key: 'Cache-Control', value: 'no-store' }] }] }, null, 2));
console.log(`web build → ${out}`);
