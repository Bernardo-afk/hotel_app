import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  globalSetup: '<rootDir>/src/test-global-setup.ts',
  globalTeardown: '<rootDir>/src/test-global-teardown.ts',
};

export default config;
