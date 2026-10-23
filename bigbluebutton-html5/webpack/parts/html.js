/* eslint-disable import/no-extraneous-dependencies */
// Render the browser gate template without automatic asset injection.
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (options) => ({
  name: 'html',
  plugins: options.isSafari ? [] : [new HtmlWebpackPlugin({
    template: './client/main.html',
    filename: 'index.html',
    inject: false,
    templateParameters: (compilation, assets, assetTags, pluginOptions) => ({
      compilation,
      webpackConfig: compilation.options,
      htmlWebpackPlugin: { tags: assetTags, files: assets, options: pluginOptions },
      entries: { default: assets.js[0], safari: options.safariEntry },
    }),
  })],
});
