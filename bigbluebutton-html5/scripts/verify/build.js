#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { inspectBundle } = require('./jsc236843');

const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'dist');
const strict = process.env.BBB_HTML5_VERIFY_STRICT === '1';
const failures = [];
const files = [];

function walk(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.js')) files.push(fullPath);
  });
}

walk(dist);
const emittedFiles = files.filter((file) => /(?:bundle|[\\/]\d+)\.[a-f0-9]+\.js$/.test(file));
const esCheckBin = path.join(root, 'node_modules/.bin/es-check');
const featureCheck = spawnSync(esCheckBin, [
  'checkBrowser', ...emittedFiles, '--checkFeatures', '--checkForPolyfills',
  '--ignore', 'Object.hasOwn', '--noColor',
], { encoding: 'utf8' });
console.log('[verify] es-check features:', featureCheck.status === 0 ? 'pass' : 'reported findings');
if (featureCheck.status !== 0) console.log((featureCheck.stdout || featureCheck.stderr).trim());

const safariFiles = emittedFiles.filter((file) => file.includes(`${path.sep}safari${path.sep}`));
const defaultFiles = emittedFiles.filter((file) => !safariFiles.includes(file));
const findTriggers = (names) => names.flatMap(inspectBundle);
const safariFindings = findTriggers(safariFiles);
const defaultFindings = findTriggers(defaultFiles);
const safariTriggers = safariFindings.length;
const defaultTriggers = defaultFindings.length;
console.log(`[verify] WebKit 236843 triggers: safari=${safariTriggers} default=${defaultTriggers}`);
defaultFindings.forEach((finding) => {
  const original = finding.original && finding.original.source
    ? `${finding.original.source}:${finding.original.line}:${finding.original.column}` : 'source map unavailable';
  console.log(`[verify] WebKit 236843 default finding: ${original}; outer=${finding.outerBindings.join(',')}; generated=${finding.generated.line}:${finding.generated.column}`);
});
if (safariTriggers) failures.push('WebKit 236843 safari trigger');

const targets = fs.readFileSync(path.join(root, '.browserslistrc'), 'utf8');
const template = fs.readFileSync(path.join(root, 'client/main.html'), 'utf8');
[['chrome', '87'], ['firefox', '80'], ['safari', '14.1']].forEach(([browser, version]) => {
  if (!targets.includes(`${browser} >= ${version}`)) failures.push(`${browser} browserslist floor`);
});
if (!template.includes('chrome: 87') || !template.includes('firefox: 80') || !template.includes('safari: 14')) {
  failures.push('gate/browser target alignment');
}
console.log('[verify] gate and browserslist floors checked');

const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
['findLast', 'findLastIndex', 'structuredClone', 'randomUUID'].forEach((api) => {
  console.log(`[verify] runtime API ${api}: ${source.split(api).length - 1} reference(s)`);
});

if (failures.length) {
  console.error(`[verify] findings: ${failures.join(', ')}`);
  if (strict) process.exitCode = 1;
} else console.log('[verify] all checks passed');
