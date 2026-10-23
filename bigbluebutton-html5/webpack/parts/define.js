/* eslint-disable import/no-extraneous-dependencies */
// Inject compile-time environment values into client code.
const webpack = require('webpack');

module.exports = (options) => ({
  name: 'define',
  plugins: [new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(options.mode), 'process.env.DETAILED_LOGS': JSON.stringify(options.detailedLogs),
  })],
});
