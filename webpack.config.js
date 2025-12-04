const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'cockpit/dist'),
    filename: 'mdp.js',
    chunkFilename: '[name].[contenthash].chunk.js',
    publicPath: 'dist/', // Relative path - will be overridden by __webpack_public_path__ in HTML
    clean: true
  },
  optimization: {
    splitChunks: {
      chunks: 'async',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'async',
          priority: 10
        }
      }
    }
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'mdp.css',
      chunkFilename: '[name].[contenthash].chunk.css'
    })
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      'cockpit-dark-theme': path.resolve(__dirname, 'src/cockpit-dark-theme.ts')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: './'
            }
          },
          'css-loader'
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: '[name].[contenthash][ext]'
        }
      }
    ]
  },
  externals: {
    'cockpit': 'cockpit'
  },
  devtool: 'source-map'
};

