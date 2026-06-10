/**
 * jest.config.js
 * CarbonMirror — Jest configuration for ES Module support.
 * Requires Node.js ≥ 16 (uses --experimental-vm-modules).
 */
export default {
  /** Use Node.js environment — calculator.js has zero browser API dependencies */
  testEnvironment: 'node',

  /** No transform: let Node.js handle native ESM directly */
  transform: {},

  /** Match all *.test.js files in the project */
  testMatch: ['**/*.test.js'],

  /** Show individual test names in the output */
  verbose: true,

  /** Coverage collection targets the core calculation module */
  collectCoverageFrom: [
    'calculator.js',
  ],

  /** Minimum coverage thresholds */
  coverageThreshold: {
    global: {
      lines:     70,
      functions: 70,
      branches:  50,
    },
  },

  /** Describe which extensions are treated as ES modules */
  extensionsToTreatAsEsm: [],
};
