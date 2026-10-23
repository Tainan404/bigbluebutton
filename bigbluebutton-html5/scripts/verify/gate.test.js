#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const template = fs.readFileSync(path.join(__dirname, '../../client/main.html'), 'utf8');
const inline = [...template.matchAll(/<script>\s*([\s\S]*?)\s*<\/script>/g)]
  .map((match) => match[1]).find((script) => script.includes('(function ()'))
  .replace('<%= JSON.stringify(entries) %>', JSON.stringify({ default: 'default.js', safari: 'safari.js' }));
const hasEngineProbe = template.includes('function hasJSC236843()');

const cases = [
  ['Chrome 141', 'Mozilla/5.0 Chrome/141.0.0.0 Safari/537.36', false, 'default.js'],
  ['Chrome 87', 'Mozilla/5.0 Chrome/87.0.0.0 Safari/537.36', false, 'default.js'],
  ['Edge 85', 'Mozilla/5.0 Chrome/85.0 Edg/85.0 Safari/537.36', false, null],
  ['Firefox 80', 'Mozilla/5.0 Firefox/80.0', false, 'default.js'],
  ['Firefox 89', 'Mozilla/5.0 Firefox/89.0', false, 'default.js'],
  ['Firefox ESR 78', 'Mozilla/5.0 Firefox/78.0', false, null],
  ['Safari 14.0', 'Mozilla/5.0 Version/14.0 Safari/605.1.15', false, 'safari.js'],
  ['Safari 14.1', 'Mozilla/5.0 Version/14.1 Safari/605.1.15', true, 'safari.js'],
  ['Safari 15.6', 'Mozilla/5.0 Version/15.6 Safari/605.1.15', true, 'safari.js'],
  ['Safari 16.3', 'Mozilla/5.0 Version/16.3 Safari/605.1.15', false, 'default.js'],
  ['Safari 26', 'Mozilla/5.0 Version/26.0 Safari/605.1.15', false, 'default.js'],
  ['iPadOS desktop', 'Mozilla/5.0 Macintosh Version/15.0 Safari/605.1.15', true, 'safari.js'],
  ['iOS 15.7 Safari', 'Mozilla/5.0 iPhone Version/15.7 Mobile Safari/604.1', true, 'safari.js'],
  ['iOS 15.7 CriOS', 'Mozilla/5.0 iPhone CriOS/141.0 Mobile/15E148 Safari/604.1', true, 'safari.js', 'default.js'],
  ['iOS 15.7 FxiOS', 'Mozilla/5.0 iPhone FxiOS/143.0 Mobile/15E148 Safari/605.1.15', true, 'safari.js', 'default.js'],
  ['iOS 15.7 WKWebView', 'Mozilla/5.0 iPhone Mobile/15E148 AppleWebKit/605.1.15', true, 'safari.js', 'default.js'],
  ['iOS 14.4 CriOS', 'Mozilla/5.0 iPhone CriOS/87.0 Mobile/15E148 Safari/604.1', true, 'safari.js', 'default.js'],
  ['Android WebView', 'Mozilla/5.0 Linux; Android 13; wv Chrome/141.0 Mobile Safari/537.36', false, 'default.js'],
  ['Samsung Internet 13', 'Mozilla/5.0 Android SamsungBrowser/13.0 Chrome/83.0 Mobile Safari/537.36', false, null],
];

cases.forEach(([name, userAgent, affectedEngine, expectedWithProbe, expectedWithoutProbe = expectedWithProbe]) => {
  const expected = hasEngineProbe ? expectedWithProbe : expectedWithoutProbe;
  let selected = null;
  const RTCPeerConnection = function PeerConnection() {};
  RTCPeerConnection.prototype.addTransceiver = () => {};
  RTCPeerConnection.prototype.addTrack = () => {};
  const context = {
    navigator: { userAgent, mediaDevices: {} },
    WeakRef: function WeakRef() {},
    RTCPeerConnection,
    Function: function ProbeFunction() { return () => !affectedEngine; },
    document: {
      documentElement: { classList: { add: () => {} } },
      createElement: () => ({}),
      getElementById: () => ({ appendChild: () => {} }),
      head: { appendChild: (script) => { selected = script.src; } },
    },
    Object,
  };
  vm.runInNewContext(inline, context);
  assert.strictEqual(selected, expected, name);
});

process.stdout.write(`gate matrix passed: ${cases.length} cases\n`);
