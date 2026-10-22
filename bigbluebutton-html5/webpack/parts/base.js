/* eslint-disable max-len */
// Define entry, output, source maps, and module resolution.
const path = require('path');

module.exports = (options, paths) => ({
  name: 'base',
  config: {
    entry: './client/main.tsx',
    output: {
      filename: options.isSafari ? 'safari/bundle.[contenthash].js' : 'bundle.[contenthash].js',
      chunkFilename: options.isSafari ? 'safari/[id].[contenthash].js' : '[id].[contenthash].js',
      assetModuleFilename: '[hash][ext][query]',
      path: paths.dist,
      publicPath: '',
    },
    devtool: 'source-map',
    resolve: {
      modules: ['node_modules'],
      roots: [paths.root],
      enforceExtension: false,
      fullySpecified: false,
      extensions: ['.mjs', '.js', '.jsx', '.tsx', '.ts', '...'],
      alias: {
        '/client': `${paths.client}/`,
        '@tiptap/core/jsx-runtime': path.join(paths.root, 'node_modules/@tiptap/core/dist/jsx-runtime/jsx-runtime.js'),
        yjs: path.join(paths.root, 'node_modules/yjs'),
      },
    },
  },
});
