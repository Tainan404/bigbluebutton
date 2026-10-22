/* eslint-disable import/no-extraneous-dependencies */
// Copy public and private runtime files into the distribution.
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (options) => ({ name: 'static-files', plugins: options.isSafari ? [] : [new CopyPlugin({ patterns: [{ from: 'public', to: '.' }, { from: 'private', to: 'private' }] })] });
