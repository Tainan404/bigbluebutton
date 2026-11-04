/* eslint-disable import/no-extraneous-dependencies */
// Emit precompressed production assets for nginx gzip_static.
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = (options) => ({ name: 'compression', plugins: options.mode === 'production' ? [new CompressionPlugin()] : [] });
