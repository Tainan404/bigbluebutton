/* eslint-disable import/no-extraneous-dependencies */
// Retain the existing CSS extraction plugin position; its loader is not enabled.
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = () => ({
  name: 'mini-css',
  plugins: [new MiniCssExtractPlugin({ filename: 'styles.css' })],
});
