const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true, // Skip type checking for now
          }
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Images
        { from: 'src/assets/images/screenshot.png', to: 'screenshot.png' },
        
        // Data files
        { from: 'src/assets/data/GreatBritishEscapades2025.fit', to: 'GreatBritishEscapades2025.fit', noErrorOnMissing: true },
        
        // Favicon files - copy to root for proper browser detection
        { from: 'src/assets/icons/apple-touch-icon.png', to: 'apple-touch-icon.png', noErrorOnMissing: true },
        { from: 'src/assets/icons/favicon-32x32.png', to: 'favicon-32x32.png', noErrorOnMissing: true },
        { from: 'src/assets/icons/favicon-16x16.png', to: 'favicon-16x16.png', noErrorOnMissing: true },
        { from: 'src/assets/icons/favicon.ico', to: 'favicon.ico', noErrorOnMissing: true },
        { from: 'src/assets/icons/android-chrome-192x192.png', to: 'android-chrome-192x192.png', noErrorOnMissing: true },
        { from: 'src/assets/icons/android-chrome-512x512.png', to: 'android-chrome-512x512.png', noErrorOnMissing: true },
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
