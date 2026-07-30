const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? 'index.html' : req.url.slice(1);
  let ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.css') contentType = 'text/css';
  if (ext === '.js') contentType = 'application/javascript';

  fs.readFile(path.join(__dirname, filePath), (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('File not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

        const wrap = document.querySelector('div[style*="text-align:center"]');
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayContainer = wrap.querySelector('div[style*="justify-content:center; gap: 8px"]');
        dayContainer.innerHTML = '';
        days.forEach((d, i) => {
            const open = i < 6;
            const el = document.createElement('div');
            el.style.cssText = `
      width:52px; height:52px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:13px; font-weight:500;
      background:${open ? '#dcfce7' : '#f3f4f6'};
      color:${open ? '#166534' : '#9ca3af'};
      border: 0.5px solid ${open ? '#86efac' : '#e5e7eb'};
      animation: slideIn 0.5s ease-out ${0.18 * i + 1.6}s both;
    `;
            el.textContent = d;
            dayContainer.appendChild(el);
        });