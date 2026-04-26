const path = require('path');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/*.test.js'],
  // Map all src/ requires so they resolve correctly from deeply nested test dirs
  moduleDirectories: ['node_modules', path.resolve(__dirname)],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',           // entry point (starts server)
    '!src/config/db.js',     // raw DB pool
    '!src/config/redis.js',  // raw Redis client
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
