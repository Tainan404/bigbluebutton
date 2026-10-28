// Configure image emission.
module.exports = () => ({ name: 'assets', rules: [{ test: /\.(png|svg|jpg|gif)$/, exclude: /node_modules/, use: ['file-loader'] }] });
