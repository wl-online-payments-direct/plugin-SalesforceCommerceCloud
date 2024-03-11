var path = require('path');
var ExtractTextPlugin = require('sgmf-scripts')['extract-text-webpack-plugin'];

module.exports = [{
        mode: 'production',
        name: 'js',
        entry: {
            'cartridges/bm_worldline_direct/cartridge/static/default/worldlinebm/js/worldlineAdmin': path.resolve('./cartridges/bm_worldline_direct/cartridge/client/default/worldlinebm/js/worldlineAdmin.js'),
            'cartridges/int_worldline_direct/cartridge/static/default/js/checkout': path.resolve('./cartridges/int_worldline_direct/cartridge/client/default/js/checkout.js')
        },
        output: {
            path: path.resolve('./'),
            filename: '[name].js'
        }
    }, {
        mode: 'production',
        name: 'scss',
        entry: {
            'cartridges/bm_worldline_direct/cartridge/static/default/worldlinebm/css/bm': path.resolve('./cartridges/bm_worldline_direct/cartridge/client/default/worldlinebm/scss/bm.scss'),
            'cartridges/int_worldline_direct/cartridge/static/default/css/checkout/worldlineCheckout': path.resolve('./cartridges/int_worldline_direct/cartridge/client/default/scss/checkout/worldlineCheckout.scss')
        },
        output: {
            path: path.resolve('./'),
            filename: '[name].css'
        },
        module: {
            rules: [{
                test: /\.scss$/,
                use: ExtractTextPlugin.extract({
                    use: [{
                        loader: 'css-loader',
                        options: {
                            url: false,
                            minimize: true
                        }
                    }, {
                        loader: 'postcss-loader',
                        options: {
                            plugins: [
                                require('autoprefixer')()
                            ]
                        }
                    }, {
                        loader: 'sass-loader',
                        options: {
                            includePaths: [
                                path.resolve('node_modules'),
                                path.resolve('node_modules/flag-icon-css/sass')
                            ]
                        }
                    }]
                })
            }]
        },
        plugins: [
            new ExtractTextPlugin({
                filename: '[name].css'
            })
        ]
    }
];
