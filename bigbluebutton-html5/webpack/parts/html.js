/* eslint-disable import/no-extraneous-dependencies */
// Render the browser gate template without automatic asset injection.
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (options) => ({
  name: 'html',
  plugins: [new HtmlWebpackPlugin({
    template: './client/main.html',
    filename: 'index.html',
    inject: false,
    templateParameters: (compilation, assets, assetTags, pluginOptions) => ({
      compilation,
      webpackConfig: compilation.options,
      htmlWebpackPlugin: { tags: assetTags, files: assets, options: pluginOptions },
      bundleHash: compilation.hash,
      isProduction: options.mode === 'production',
    }),
  })],
});
