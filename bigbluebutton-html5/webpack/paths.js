// Define every filesystem path used by webpack.
const path = require('path');

const root = path.resolve(__dirname, '..');
module.exports = Object.freeze({
  root,
  client: path.join(root, 'client'),
  dist: path.join(root, 'dist'),
  tldrawBuildId: path.join(root, '.tldraw-build-id'),
});
