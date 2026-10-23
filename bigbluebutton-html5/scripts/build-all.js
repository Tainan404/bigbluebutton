#!/usr/bin/env node
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const run = (script) => {
  const startedAt = Date.now();
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  process.stdout.write(`[build:all] ${script} completed in ${seconds}s\n`);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

fs.rmSync('dist', { recursive: true, force: true });
run('build-safari');
run('build');
