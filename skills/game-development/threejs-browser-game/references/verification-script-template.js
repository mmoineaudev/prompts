const fs = require('fs');
const path = process.cwd();
let ok = true;
const assert = (label, cond) => cond ? console.log('PASS:', label) : (console.error('FAIL:', label), ok = false);

const checks = [
  // edit this list per changed files
  ['src/systems/PhysicsSystem.js', ['damage: Constants.HEALTH.COLLISION_DAMAGE', 'const normal = new THREE.Vector3()', 'vel.addScaledVector(normal, -(vn + 3.5))', 'vel.multiplyScalar(0.7)', 'shipObject.position.addScaledVector(normal, pen + 0.2)']],
  ['src/level/AsteroidField.js', ['_collidables', '_createMediumInstanced', '_createSmallInstanced']],
  ['src/level/PlanetManager.js', ['uRim * fresnel', 'float alpha =', 'if (hash < 0.18)']],
  ['src/core/Game.js', ['checkShipCollisions', 'GameState.health <= 0 && GameState.isAlive', 'HemisphereLight']],
  ['src/gameplay/PlayerShip.js', ['_createShipMesh', '_createEngineFlames']],
];

for (const [relPath, needles] of checks) {
  const abs = path + '/' + relPath;
  if (!fs.existsSync(abs)) { console.error('MISSING:', relPath); ok = false; continue; }
  const src = fs.readFileSync(abs, 'utf8');
  for (const n of needles) assert(relPath + ' contains ' + n, src.includes(n));
}

try {
  const files = checks.map(c => c[0]).map(f => `fs.readFileSync('${f}','utf8')`).join('; ');
  require('child_process').execSync("node --input-type=module -e \"import fs from 'fs'; " + files + "\"", { cwd: path, encoding: 'utf8' });
  console.log('PASS: changed files parse as ES module source');
} catch (e) {
  console.error('FAIL: parse error', e.message.split('\n')[0]);
  ok = false;
}

console.log(ok ? 'ALL VERIFICATIONS PASS' : 'VERIFICATIONS FAILED');
process.exit(ok ? 0 : 1);
