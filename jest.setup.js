/**
 * Jest setup file for global configurations and mocks
 */

// Make Jest globals available
global.jest = require('jest');

// Mock path module
jest.mock('path', () => ({
  join: (...args) => args.join('/'),
  resolve: (...args) => '/' + args.join('/'),
  extname: (path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  },
  dirname: (path) => {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/') || '/';
  },
  basename: (path) => {
    return path.split('/').pop() || '';
  },
}));

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(() => Promise.resolve('<html>Test Template</html>')),
    writeFile: jest.fn(() => Promise.resolve()),
    mkdir: jest.fn(() => Promise.resolve()),
    stat: jest.fn(() => Promise.resolve({ isFile: () => true, isDirectory: () => false })),
  },
  readFileSync: jest.fn(() => '<html>Test Template</html>'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
}));