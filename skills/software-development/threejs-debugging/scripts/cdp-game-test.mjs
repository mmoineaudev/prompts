#!/usr/bin/env node
/**
 * Headless CDP game-test harness — reusable template.
 *
 * Use when you need to test a Vite/ESM browser game at runtime but the Hermes
 * browser_navigate / browser_vision tools are unavailable, have a stale CDP
 * endpoint, or you want deterministic programmatic control (clicks, state
 * inspection, simulated game-loop steps) without a human in the loop.
 *
 * Requirements:
 *   - Node 22+ (built-in WebSocket). On older Node install `ws`.
 *   - A Chromium-family browser on PATH (chromium-browser / google-chrome).
 *   - The Vite dev server (or any static server) already running.
 *
 * Usage:
 *   1. Launch headless Chromium with remote debugging:
 *        chromium-browser --headless=new --remote-debugging-port=9222 \
 *          --remote-debugging-address=127.0.0.1 --no-sandbox \
 *          --disable-gpu --disable-dev-shm-usage --no-first-run \
 *          --disable-extensions --window-size=1280,800 about:blank
 *      (Run this as a background terminal process, not foreground.)
 *   2. Set the URL and edits below, then:
 *        node scripts/cdp-game-test.mjs
 *
 * Key gotchas encoded below:
 *   - Attach to a PAGE target from /json/list, NOT the browser target from
 *     /json/version. The browser target silently returns undefined for
 *     Runtime.evaluate.
 *   - Vite may land on a non-default port (5174, 5175, ...). Read the dev
 *     server output; don't hardcode 5173.
 *   - Wrap Runtime.evaluate expressions in try/catch + returnByValue:true
 *     so an exception surfaces as a string instead of an opaque undefined.
 *   - Enable Network.enable to capture 404s / failed resource loads.
 *   - You can drive the game by calling internal methods directly via
 *     Runtime.evaluate (e.g. window._psGame._towers.place(...)) to simulate
 *     N seconds of gameplay without waiting on real time.
 */

import http from 'http';

const URL = process.env.TEST_URL || 'http://localhost:5176/';
const CDP_HOST = process.env.CDP_HOST || '127.0.0.1';
const CDP_PORT = process.env.CDP_PORT || '9222';

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej);
  });
}

(async () => {
  // 1. Discover the PAGE target (NOT the browser target).
  const list = await getJSON(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
  const page = list.find(t => t.type === 'page');
  if (!page) { console.log('NO_PAGE_TARGET'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let msgId = 1; const pending = new Map(); const logs = []; const errs404 = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { resolve } = pending.get(msg.id); pending.delete(msg.id); resolve(msg.result); }
    else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text));
    else if (msg.method === 'Network.responseReceived' && msg.params.response?.status === 404) errs404.push(msg.params.response.url);
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type==='error') logs.push('ERR: '+msg.params.args.map(a=>a.value||a.description).join(' '));
  });
  function send(method, params={}) { return new Promise((resolve, reject) => { const id = msgId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }
  function evalJS(expression) { return send('Runtime.evaluate', { expression, returnByValue: true }); }

  ws.addEventListener('open', async () => {
    await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
    await send('Page.navigate', { url: URL });
    await new Promise(r => setTimeout(r, 4000)); // wait for game to boot

    // 2. Inspect load state. Always wrap in try/catch so failures surface.
    const load = await evalJS(`(() => {
      try {
        return JSON.stringify({
          title: document.title,
          gameLoaded: typeof window._psGame,
          sceneChildren: window._psGame?._renderSystem?.scene?.children?.length || 0,
          hudLen: document.getElementById('hud')?.innerHTML?.length || 0,
        });
      } catch(e) { return 'CAUGHT: ' + e.message; }
    })()`);
    console.log('LOAD:', load?.result?.value);

    // 3. Drive the game via UI clicks (EventBus) and internal methods.
    await evalJS(`document.querySelector('.wave-btn')?.click()`); // start a wave
    await new Promise(r => setTimeout(r, 300));
    // Place towers programmatically by calling the manager directly:
    await evalJS(`(() => {
      const g = window._psGame; if (!g) return 'no game';
      const ps = g._pathSystem; const st = g._gs.state; const tm = g._towers;
      let placed = 0;
      for (let qx=0; qx<28 && placed<7; qx+=4) {
        const idx = 9*28+qx; // adjust to YOUR grid layout
        if (!ps.pathTiles.has(idx) && st.grid[idx]==='empty' && st.money>=25) {
          if (tm.place(st, idx, qx, 9, 0, st.path)) placed++;
        }
      }
      return 'placed='+placed;
    })()`);

    // 4. Simulate N seconds of gameplay by calling the loop steps directly.
    await evalJS(`(() => {
      const g = window._psGame; const st = g._gs.state;
      for (let i=0;i<150;i++) {
        const dt = 0.1;
        if (st.over || st.paused) break;
        g._towers.update(dt, st);
        g._towerFire(dt, st);
        g._enemies.update(dt, st, g._pathSystem, g._towers.towers);
        g._projectiles.update(dt, g._enemies, st);
        g._collisions.update(dt, st, g._projectiles, g._enemies, g._towers, g._particles);
        g._particles.update(dt);
      }
      return 'sim done';
    })()`);

    // 5. Report final state.
    const finalState = await evalJS(`JSON.stringify({
      towers: window._psGame?._towers?.towers?.length||0,
      enemies: window._psGame?._enemies?.enemies?.length||0,
      projectiles: window._psGame?._projectiles?.objs?.length||0,
      kills: window._psGame?._gs?.state?.stats?.enemiesKilled||0,
      lives: window._psGame?._gs?.state?.lives||0,
      money: window._psGame?._gs?.state?.money||0,
      wave: window._psGame?._gs?.state?.wave||0,
      over: window._psGame?._gs?.state?.over||false,
    })`);
    console.log('FINAL:', finalState?.result?.value);
    console.log('404s:', errs404);
    console.log('ERRORS:', logs);
    process.exit(0);
  });
  ws.addEventListener('error', (e) => { console.log('WS_ERR:', e.message||e); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 25000);
})();
