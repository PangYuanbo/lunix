const fs = require('fs');
const path = require('path');

if (process.platform === 'darwin') {
  const helper = path.join(require.resolve('node-pty/package.json'), '..', 'prebuilds', `darwin-${process.arch}`, 'spawn-helper');
  if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
}
