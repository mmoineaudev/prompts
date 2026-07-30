#!/usr/bin/env node
/**
 * Event Bus Completeness Audit
 *
 * Scans all JS files in a project for EventBus.emit() and EventBus.on()
 * calls and reports any event names that have emits without listeners
 * or listeners without emits.
 *
 * Usage: node event-bus-audit.js /path/to/src
 *
 * Exit 0 = all events matched. Exit 1 = mismatches found.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = process.argv[2] || path.join(process.cwd(), 'src');

if (!fs.existsSync(SRC_DIR)) {
  console.error(`ERROR: Directory not found: ${SRC_DIR}`);
  process.exit(1);
}

const emits = {};
const listeners = {};

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      scanFile(fullPath, dir);
    }
  }
}

function scanFile(filePath, baseDir) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(baseDir, path.dirname(filePath));
  const fileName = path.basename(filePath);

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const location = `${relPath}/${fileName}:${lineNum}`;

    // Match EventBus.emit('event:action'
    const emitRe = /EventBus\.emit\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = emitRe.exec(line)) !== null) {
      emits.setdefault(m[1], []).push(`emits:   ${location}`);
    }

    // Match EventBus.on('event:action'
    const onRe = /EventBus\.on\(\s*['"]([^'"]+)['"]/g;
    while ((m = onRe.exec(line)) !== null) {
      listeners.setdefault(m[1], []).push(`listens: ${location}`);
    }
  }
}

// Polyfill Map.setdefault for older Node
if (!Map.prototype.setdefault) {
  Map.prototype.setdefault = function(key, defaultValue) {
    if (!this.has(key)) this.set(key, defaultValue);
    return this.get(key);
  };
}

scanDir(SRC_DIR);

const allEvents = new Set([...Object.keys(emits), ...Object.keys(listeners)]);
let hasMismatches = false;

console.log('=== Event Bus Completeness Audit ===\n');

for (const event of [...allEvents].sort()) {
  const hasEmit = event in emits;
  const hasListener = event in listeners;

  if (hasEmit && hasListener) {
    console.log(`✓ ${event}`);
  } else {
    hasMismatches = true;
    console.log(`✗ ${event} (${hasEmit ? 'EMITTED but no listener' : 'LISTENED but no emitter'})`);
    if (hasEmit) {
      for (const loc of emits[event]) console.log(`    ${loc}`);
    }
    if (hasListener) {
      for (const loc of listeners[event]) console.log(`    ${loc}`);
    }
  }
}

console.log('');
if (hasMismatches) {
  console.log('⚠ MISMATCHES FOUND — review above and add missing emit/listener pairs.');
  process.exit(1);
} else {
  console.log('✅ All events matched — emit/listener completeness verified.');
  process.exit(0);
}
