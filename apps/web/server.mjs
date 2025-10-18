import { createServer } from 'https';
import { parse } from 'url';
import next from 'next';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

// Disable certificate validation in development (for self-signed certs)
if (dev) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Load SSL certificates
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost.pem')),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('Starting Next.js...');

app.prepare().then(() => {
  console.log('Next.js prepared, starting HTTPS server...');
  
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`\n✓ Ready on https://localhost:${port}`);
      console.log(`✓ Network: https://10.150.133.214:${port}`);
      console.log(`✓ Network: https://0.0.0.0:${port}\n`);
    });
}).catch((err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});
