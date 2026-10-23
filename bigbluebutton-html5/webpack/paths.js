// Define every filesystem path used by webpack.
const path = require('path');

const root = path.resolve(__dirname, '..');
module.exports = Object.freeze({
  root,
  client: path.join(root, 'client'),
  dist: path.join(root, 'dist'),
  config: path.join(root, 'webpack.config.js'),
  babelConfig: path.join(root, 'babel.config.js'),
  browserslist: path.join(root, '.browserslistrc'),
  safariManifest: path.join(root, 'dist/safari.entry.json'),
  tldrawBuildId: path.join(root, '.tldraw-build-id'),
});
