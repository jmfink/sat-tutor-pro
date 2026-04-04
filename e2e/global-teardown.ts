import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

async function globalTeardown() {
  // Remove saved auth state between runs (fresh login each run)
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
  console.log('[Playwright] Auth state cleaned up.');
}

export default globalTeardown;
