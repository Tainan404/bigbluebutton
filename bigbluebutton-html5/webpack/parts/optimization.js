/* eslint-disable max-len, import/no-extraneous-dependencies */
// Configure production minification and size budgets; async splitting stays enabled.
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (options) => ({
  name: 'optimization',
  config: {
    mode: options.mode,
    ...(options.mode === 'production' && {
      optimization: {
        minimize: true,
        minimizer: options.isSafari ? [] : [new TerserPlugin({
          terserOptions: {
            // why: the tablet app inspects this stack-frame name to route native screen sharing (commit 04cf08e22c9).
            keep_fnames: /startScreensharing/,
          },
        })],
      },
      // why: the unminified Safari compatibility bundle is intentionally larger (commit 835d2243b92).
      performance: { hints: 'warning', maxAssetSize: options.isSafari ? 16000000 : 8000000, maxEntrypointSize: options.isSafari ? 16000000 : 8000000 },
    }),
  },
  plugins: [],
});
