module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-reanimated/plugin'],
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@services': './src/services',
            '@store': './src/store',
            '@native': './src/native',
            '@theme': './src/theme',
            '@utils': './src/utils',
            '@assets': './assets',
            '@shared': '../shared',
            // Direct imports from sibling sources — see Validator/ADD_MOBILE_APP.md
            // Phase 0 "path-alias" approach. Keeps Mobile in lock-step with
            // the shipped Wallet extension and WebApp without extracting code.
            '@wallet': '../Wallet/src',
            '@webapp': '../WebApp/src',
          },
        },
      ],
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};