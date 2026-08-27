module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets powers Reanimated 4 — must stay last.
      'react-native-worklets/plugin',
    ],
  };
};
