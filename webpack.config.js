const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/screenshot.png', to: 'screenshot.png' },
        { from: 'src/GreatBritishEscapades2025.fit', to: 'GreatBritishEscapades2025.fit', noErrorOnMissing: true },
        // Favicon files
        { from: 'src/apple-touch-icon.png', to: 'apple-touch-icon.png', noErrorOnMissing: true },
        { from: 'src/favicon-32x32.png', to: 'favicon-32x32.png', noErrorOnMissing: true },
        { from: 'src/favicon-16x16.png', to: 'favicon-16x16.png', noErrorOnMissing: true },
        { from: 'src/favicon.ico', to: 'favicon.ico', noErrorOnMissing: true },
        { from: 'src/site.webmanifest', to: 'site.webmanifest', noErrorOnMissing: true },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 3000,
    open: true,
  },
  mode: 'development',
};
