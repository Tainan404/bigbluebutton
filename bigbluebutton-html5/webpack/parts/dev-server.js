/* eslint-disable import/no-extraneous-dependencies */
// Configure the proxied development server and hot refresh.
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = (options) => ({
  name: 'dev-server',
  plugins: options.isDev && options.hot ? [new ReactRefreshWebpackPlugin({
    overlay: false, exclude: /worker\.ts$/, // why: workers cannot host the React refresh runtime.
  })] : [],
  config: options.isDev ? {
    devServer: {
      port: 3000,
      hot: true,
      allowedHosts: 'all',
      client: {
        overlay: false, webSocketURL: 'auto://0.0.0.0:0/html5client/ws', // why: HMR traverses the nginx proxy.
      },
      setupMiddlewares: (middlewares, server) => {
        if (!server) throw new Error('webpack-dev-server is not defined');
        server.app.use((req, res, next) => {
          // why: avoid a webpack-dev-server HEAD crash (commit e93388a6a23).
          if (req.method === 'HEAD') { res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Length', '0'); res.end(); } else next();
        });
        return middlewares;
      },
    },
  } : {},
});
