module.exports = function (api) {
  api.cache(true);

  const presets = [
    [
      "babel-preset-expo",
      {
        jsxRuntime: "automatic",
        jsxImportSource: "react",
        unstable_transformProfile: "hermes-stable",
      },
    ],
  ];

  const plugins = [
    [
      "module-resolver",
      {
        root: ["./"],
        extensions: [
          ".ios.js",
          ".android.js",
          ".js",
          ".jsx",
          ".json",
          ".tsx",
          ".ts",
          ".native.js",
          ".mjs",
        ],
        alias: {
          "^react-native$": "react-native-web",
          "@components": "./components",
          "@assets": "./assets",
          services: "./src/services",
        },
      },
    ],
    [
      "@babel/plugin-transform-runtime",
      {
        helpers: true,
        regenerator: false,
        absoluteRuntime: false,
      },
    ],
    "react-native-reanimated/plugin",
  ];

  return {
    presets,
    plugins,
    env: {
      production: {
        plugins: ["transform-remove-console"],
      },
    },
  };
};
