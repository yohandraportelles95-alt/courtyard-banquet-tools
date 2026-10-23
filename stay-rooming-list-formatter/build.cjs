const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = __dirname;
fs.mkdirSync(path.join(root, 'dist', 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, 'dist', 'index.html'));
fs.copyFileSync(path.join(root, 'assets', 'index-DX4CMHCm.css'), path.join(root, 'dist', 'assets', 'index-DX4CMHCm.css'));
fs.writeFileSync(path.join(root, 'dist', 'assets', 'index-roomtypes-20261023.js'), zlib.gunzipSync(fs.readFileSync(path.join(root, 'assets', 'app.js.gz'))));
console.log('Static formatter ready in dist/');
