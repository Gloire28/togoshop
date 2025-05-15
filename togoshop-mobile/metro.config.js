const { getDefaultConfig } = require("@expo/metro-config");
const defaultConfig = getDefaultConfig(__dirname);
const path = require("path");

module.exports = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      "jsx",
      "js",
      "ts",
      "tsx",
      "mjs",
      "svg",
    ],
    assetExts: [...defaultConfig.resolver.assetExts, "db", "sqlite", "cjs"],
    extraNodeModules: {
      "react-native": require.resolve("react-native-web"),
      "react-native/Libraries": path.dirname(
        require.resolve("react-native-web/dist/index.js"),
      ),
      "react-native/Libraries/Utilities": path.dirname(
        require.resolve("react-native-web/dist/exports/Platform"),
      ),
      "react-native/Libraries/Utilities/Platform": require.resolve(
        "react-native-web/dist/exports/Platform",
      ),
      "react-native/Libraries/ReactPrivate": path.dirname(
        require.resolve("react-native-web/dist/index.js"),
      ),
      "react-native/Libraries/ReactPrivate/ReactNativePrivateInterface":
        require.resolve("react-native-web/dist/exports/Platform"),
    },
  },
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
    getTransformOptions: async () => ({
      transform: { experimentalImportSupport: false, inlineRequires: true },
    }),
  },
};
