// Configure CSS loading and browser prefixing.
module.exports = () => ({
  name: 'styles',
  rules: [{
    test: /\.css$/,
    use: ['style-loader', { loader: 'css-loader' }, {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: [['autoprefixer', { overrideBrowserslist: ['last 2 versions', '>1%'] }]],
        },
      },
    }],
  }],
});
