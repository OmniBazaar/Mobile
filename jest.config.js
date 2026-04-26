/**
 * Jest configuration — Phase 1.
 *
 * Lean: pure TypeScript tests only. React component tests + Expo module
 * mocking is wired up in Phase 8 via jest-expo + React Native Testing
 * Library. For now we need just enough to exercise the auth / crypto
 * service modules.
 *
 * The `moduleNameMapper` lane mirrors the tsconfig.json + metro.config.js
 * path aliases so tests can import from `@wallet/*` and `@webapp/*`
 * exactly as production code does.
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.(js|jsx|ts|tsx)'],
  // Skip the EAS-only sibling-source snapshot — it isn't part of the
  // Mobile test surface and otherwise raises a haste-map "duplicate
  // manual mock" warning when both Wallet/src and WebApp/src ship
  // identically-named __mocks__ files.
  modulePathIgnorePatterns: ['<rootDir>/.bundled/'],
  haste: { providesModuleNodeModules: [] },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          skipLibCheck: true,
          target: 'ES2020',
          module: 'commonjs',
          moduleResolution: 'node',
          strict: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          baseUrl: '.',
          paths: {
            '@/*': ['src/*'],
            '@components/*': ['src/components/*'],
            '@theme/*': ['src/theme/*'],
            '@wallet/*': ['../Wallet/src/*'],
            '@webapp/*': ['../WebApp/src/*'],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@wallet/(.*)$': '<rootDir>/../Wallet/src/$1',
    '^@webapp/(.*)$': '<rootDir>/../WebApp/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
  ],
};
