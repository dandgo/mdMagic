/**
 * Basic unit tests for mdMagic extension
 */

import * as extension from '../extension';

// Mock VS Code API
const vscode = {
  ExtensionContext: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
  },
};

// Mock VS Code module
jest.mock('vscode', () => vscode, { virtual: true });

describe('mdMagic Extension', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
    };
    jest.clearAllMocks();
  });

  describe('activate', () => {
    it('should activate without errors', () => {
      expect(() => {
        extension.activate(mockContext);
      }).not.toThrow();
    });

    it('should log activation message', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      extension.activate(mockContext);
      expect(consoleSpy).toHaveBeenCalledWith('mdMagic extension is now active!');
      consoleSpy.mockRestore();
    });
  });

  describe('deactivate', () => {
    it('should deactivate without errors', () => {
      expect(() => {
        extension.deactivate();
      }).not.toThrow();
    });

    it('should log deactivation message', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      extension.deactivate();
      expect(consoleSpy).toHaveBeenCalledWith('mdMagic extension is being deactivated');
      consoleSpy.mockRestore();
    });
  });
});
