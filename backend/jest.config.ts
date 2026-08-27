import type { Config } from 'jest';

/**
 * ESM + TypeScript. `npm test` sets NODE_OPTIONS=--experimental-vm-modules via
 * cross-env, which ts-jest's ESM mode requires.
 */
const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  // Source imports carry the `.js` extension NodeNext requires; strip it so
  // Jest resolves the `.ts` file it is actually compiling.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
  clearMocks: true,
  restoreMocks: true,
};

export default config;
