const path = require( 'path' );

module.exports = ( _env, argv ) => {
    const isDev = argv.mode === 'development';

    return {
        entry: './admin/app.js',

        output: {
            path: path.resolve( __dirname, 'build' ),
            filename: 'index.js',
            clean: true,
        },

        mode: isDev ? 'development' : 'production',
        devtool: isDev ? 'source-map' : false,

        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                    },
                },
                {
                    test: /\.css$/i,
                    use: [ 'style-loader', 'css-loader' ],
                },
            ],
        },

        resolve: {
            extensions: [ '.js', '.jsx' ],
        },
    };
};
