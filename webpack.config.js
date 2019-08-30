const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'node',
  node: {
    __dirname: false
  },
  entry: {
    'lambda-edge/parse-auth/bundle': path.resolve(__dirname, './lambda-edge/parse-auth/app.js'),
    'lambda-edge/check-auth/bundle': path.resolve(__dirname, './lambda-edge/check-auth/app.js'),
    'lambda-edge/refresh-auth/bundle': path.resolve(__dirname, './lambda-edge/refresh-auth/app.js'),
    'lambda-edge/http-headers/bundle': path.resolve(__dirname, './lambda-edge/http-headers/app.js'),
    'lambda-edge/sign-out/bundle': path.resolve(__dirname, './lambda-edge/sign-out/app.js'),
  },
  resolve: {
    extensions: [ '.js' ]
  },
  output: {
    path: path.resolve(__dirname),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  externals: [
    /^aws-sdk/ // Don't include the aws-sdk in bundles as it is already present in the Lambda runtime
  ],
  performance: {
    hints: 'error',
    maxAssetSize: 1048576, // Max size of deployment bundle in Lambda@Edge Viewer Request
    maxEntrypointSize: 1048576, // Max size of deployment bundle in Lambda@Edge Viewer Request
  },
  optimization: {
    minimizer: [new TerserPlugin({
      cache: true,
      parallel: true,
      extractComments: true,
    })],
  },
}
