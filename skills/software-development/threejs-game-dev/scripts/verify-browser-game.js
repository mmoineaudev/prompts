import { spawn } from 'child_process';
import http from 'http';
import path from 'path';

const PROJECT = process.argv[2] || '.';
const files = process.argv.slice(3) || [];

function run(cmd, args, cwd) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd, stdio: 'pipe' });
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => resolve({ code, out, err }));
  });
}

(async () => {
  const targetFiles = files.map(f => path.join(PROJECT, f));
  if (!targetFiles.length) {
    console.log('Usage: node verify-browser-game.js <project-dir> <file1> [file2 ...]');
    process.exit(2);
  }
  for (const f of targetFiles) {
    const r = await run('node', ['--check', f], PROJECT);
    if (r.code !== 0) { console.log(`✗ Syntax FAIL: ${f}`); process.exit(1); }
    console.log(`✓ Syntax OK: ${path.basename(f)}`);
  }
  const b = await run('npm', ['run', 'build'], PROJECT);
  if (b.code !== 0 || !b.out.includes('✓ built')) {
    console.log('✗ Build FAILED'); console.log(b.out, b.err); process.exit(1);
  }
  console.log('✓ Build succeeded');
  const dev = spawn('npm', ['run', 'dev'], { cwd: PROJECT, stdio: 'pipe', detached: true });
  dev.unref();
  await new Promise(r => setTimeout(r, 1400));
  let port = null;
  for (let p = 5173; p <= 5185; p++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${p}`, r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
        });
        req.on('error', reject);
        req.setTimeout(400, () => { req.destroy(); resolve(null); });
      });
      port = p; break;
    } catch {}
  }
  if (!port) { console.log('✗ Dev server not reachable'); process.exit(1); }
  console.log(`✓ Dev server up on port ${port}`);
  const html = await new Promise(resolve => {
    http.get(`http://localhost:${port}`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
  if (!html) { console.log('✗ Page load failed'); process.exit(1); }
  console.log(`✓ Page loads correctly (${html.length} bytes)`);
  try { process.kill(-dev.pid, 'SIGKILL'); } catch {}
  console.log('\nAd-hoc verification complete.');
  process.exit(0);
})();
