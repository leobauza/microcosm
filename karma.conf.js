var Webpack = require('webpack')
var webpack_config = require('./webpack.config')

module.exports = function(config) {
  config.set({

    browsers: [ 'Firefox', 'Chrome' ],

    frameworks: [ 'mocha', 'sinon-chai' ],

    logLevel: config.LOG_ERROR,

    files: [
      'src/**/__tests__/*.js*',
      'example/src/**/__tests__/*.js*'
    ],

    preprocessors: {
      'src/**/__tests__/*.js*'     : [ 'webpack', 'sourcemap' ],
      'example/src/**/__tests__/*.js*' : [ 'webpack', 'sourcemap' ]
    },

    reporters: [ 'spec', 'coverage' ],

    coverageReporter: {
      reporters: [
        { type: 'html', subdir: 'report-html' },
        { type: 'lcov', subdir: 'report-lcov' }
      ]
    },

    webpack: {
      devtool : '#eval-source-map',
      plugins : webpack_config.plugins.concat([
        new Webpack.IgnorePlugin(/\.s*(c|a)ss$/)
      ]),
      resolve : webpack_config.resolve,

      module: {
        loaders: [
          {
            test    : /\.jsx*$/,
            exclude : /node_modules/,
            loader  : 'babel',
            query   : {
              stage: 0,
              loose: true,
              optional: ['runtime']
            }
          },
          {
            test    : /\.json$/,
            loader  : 'json'
          }
        ],
        postLoaders: [
          {
            test: /\.jsx*$/,
            exclude: /(__tests__|node_modules)\//,
            loader: 'istanbul-instrumenter'
          }
        ]
      }
    },

    webpackServer: {
      noInfo: true
    }
  });
};
