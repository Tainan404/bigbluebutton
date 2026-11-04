// Configure JavaScript and TypeScript transpilation.
module.exports = (options) => ({
  name: 'scripts',
  rules: [{
    test: /\.(js|jsx|ts|tsx)$/,
    resolve: { fullySpecified: false, enforceExtension: false },
    exclude: /node_modules/,
    use: { loader: 'babel-loader', options: { plugins: [(options.isDev && options.hot) && require.resolve('react-refresh/babel')].filter(Boolean) } },
  }],
});
