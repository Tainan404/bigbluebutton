// Define entry, output, source maps, and module resolution.
const path = require('path');

module.exports = (options, paths) => ({
  name: 'base',
  config: {
    entry: './client/main.tsx',
    output: { filename: options.isSafari ? 'bundle.safari.js' : 'bundle.[fullhash].js', path: paths.dist, publicPath: '' },
    devtool: 'source-map',
    resolve: {
      modules: ['node_modules', 'src'],
      enforceExtension: false,
      fullySpecified: false,
      extensions: ['.mjs', '.js', '.jsx', '.tsx', '.ts', '...'],
      alias: {
        '/client': `${paths.client}/`,
        '/imports': path.resolve(paths.root, '/imports/'),
        '@tiptap/core/jsx-runtime': path.join(paths.root, 'node_modules/@tiptap/core/dist/jsx-runtime/jsx-runtime.js'),
        yjs: path.join(paths.root, 'node_modules/yjs'),
      },
    },
  },
});
