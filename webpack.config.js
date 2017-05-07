'use strict';
// THIS IS NOT A PRODUCTION CONFIG

require('dotenv').config();
const {DefinePlugin} = require('webpack');
const ExtractPlugin = require('extract-text-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');

const plugins = [
  // DefinePlugin creates constant variables that can be 
  // accesed throught the app and configured at build time
  new DefinePlugin({
    __API_URL__: JSON.stringify(process.env.API_URL),
    __TITLE__: JSON.stringify(process.env.TITLE),
  }),
  // creates the index.html and dynamicly injects script tags
  // and link tags. This is important because our script and 
  // link tags change names on every build using '[hash]'
  new HtmlPlugin({
    title: process.env.TITLE,
  }),
  // extract plugin creates a css bundle from the css-loader
  new ExtractPlugin('bundle-[hash].css'),
];

module.exports = {
  plugins,  
  // devtool sets up source map for better error messages
  devtool: 'eval',
  // entry is the first file webpack looks at
  entry: `${__dirname}/src/main.js`,
  output: {
    // path is the dir all bundles/assets will be put in after a webpack build
    path: `${__dirname}/build`,
    // we name our bundles with a [hash] (unique random string)
    // to avoid compex cache invalidation problems when deploying
    // with CDNs
    filename: 'bundle-[hash].js',
  },
  // this devserver config redirects back to / anytime you 
  // hit another route... its usefull when building SPAs
  devServer: {
    historyApiFallback: true,
  },
  module: {
    rules: [
      // babel transpiles jsx and es6 into es5 
      {
        test: /.*\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      // sass-loader turns sass into css
      // css-loader turns css into a JS object that webpack can pass around
      // ExtractPlugin.extract takes the css loaders output and makes a bundle-[hash].css
      {
        test: /.*\.scss$/,
        loader: ExtractPlugin.extract(['css-loader', 'sass-loader']),
      },
      // the file-loader is basicly the cp command for webpack
      // url loader copys files into a build dir using the file loader
      // but if the file is < the limit it will base64 encode it and inline
      // it into the css/html (helps with pageload speed)
      {
        test: /\.(ttf|eot|woff|woff2)$/,
        loader: 'url-loader?limit=50000&name=font/[name]-[hash].[ext]',
      },
      {
        test: /\.(jpg|jpeg|tiff|gif|png)$/,
        loader: 'url-loader?limit=50000&name=image/[name]-[hash].[ext]',
      },
    ],
  },
};
