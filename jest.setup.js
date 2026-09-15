// AsyncStorage has no native module under Jest, so swap in the mock the
// library ships for exactly this purpose.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
