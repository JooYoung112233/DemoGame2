// 정적 서버 — play.html 이 engine.js·sim.js·UI 이미지를 실제로 불러오게 한다.
// file:// 로 열면 스크립트가 안 붙어서 화면만 보이고 게임이 안 돈다.
var http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
var ROOT = path.resolve(__dirname, '..');
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.webp': 'image/webp', '.woff2': 'font/woff2' };
http.createServer(function (req, res) {
  var q = decodeURIComponent(url.parse(req.url).pathname);
  // 루트에서 그대로 서빙하면 play.html 의 상대 경로가 /engine.js 로 풀려 404 가 난다
  if (q === '/' || q === '/tools/' ) { res.writeHead(302, { Location: '/tools/play.html' }); return res.end(); }
  var f = path.join(ROOT, q);
  if (f.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('no'); }
  fs.readFile(f, function (e, d) {
    if (e) { res.writeHead(404); return res.end('404 ' + q); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(8123, function () { console.log('http://localhost:8123/tools/play.html'); });
