import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
    entry: {
        index: "./frontend/index.ts"
    },
    devtool: "inline-source-map",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
    output: {
        filename: "public/[name].js",
        path: path.resolve(__dirname, "dist")
    }
};

export default config;