/* eslint-disable max-len */
// Read and validate build environment variables in one place.
const fs = require('fs');
const paths = require('./paths');

const mode = process.env.NODE_ENV || 'development';
const target = process.env.TARGET || 'default';
if (!['development', 'production'].includes(mode)) throw new Error(`Unknown NODE_ENV: ${mode}`);
if (!['default', 'safari'].includes(target)) throw new Error(`Unknown TARGET: ${target}`);

/** @typedef {{mode: string, target: string, isDev: boolean, isSafari: boolean, hot: boolean, detailedLogs: string|boolean, tldrawBuildIdExists: boolean}} BuildOptions */
const options = Object.freeze({
  mode,
  target,
  isDev: mode === 'development',
  isSafari: target === 'safari',
  hot: String(process.env.HOT_RELOAD).toLowerCase() === 'true',
  detailedLogs: process.env.DETAILED_LOGS || false,
  tldrawBuildIdExists: fs.existsSync(paths.tldrawBuildId),
});
process.stdout.write(`[html5 build] mode=${mode} target=${target} hot=${options.hot}\n`);
module.exports = options;
