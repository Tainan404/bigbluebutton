// Compose the HTML5 webpack configuration from responsibility-focused fragments.
const options = require('./webpack/options');
const paths = require('./webpack/paths');
const parts = require('./webpack/parts');

const fragments = parts.map((part) => part(options, paths));
const find = (name) => fragments.find((fragment) => fragment.name === name);

module.exports = {
  ...find('base').config,
  ...find('cache').config,
  ...find('optimization').config,
  ...find('dev-server').config,
  module: { rules: fragments.flatMap((fragment) => fragment.rules || []) },
  plugins: fragments.flatMap((fragment) => fragment.plugins || []),
};
