import * as path from "path";
module.exports = {
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
    extensions: [ ".tsx", ".ts", ".js" ]
  },
  output: {
    filename: "public/[name].js",
    path: path.resolve(__dirname, "dist")
  }
};