/**
 * Basic unit tests for mdMagic extension
 */

// Mock VS Code API first, before any imports
const mockVscode = {
  ExtensionContext: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createWebviewPanel: jest.fn(),
    registerWebviewPanelSerializer: jest.fn(() => ({ dispose: jest.fn() })),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  workspace: {
    onDidChangeConfiguration: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    onDidChangeTextDocument: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    onDidSaveTextDocument: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    onDidCloseTextDocument: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    })),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
    createFileSystemWatcher: jest.fn(() => ({
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  Disposable: jest.fn(),
  FileSystemError: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
  Uri: {
    file: jest.fn((path: string) => ({ toString: () => path, fsPath: path })),
  },
};

// Mock VS Code module
jest.mock('vscode', () => mockVscode, { virtual: true });

import * as extension from '../extension';
import { ExtensionController } from '../controllers/ExtensionController';

describe('mdMagic Extension', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      globalState: {
        get: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined)
      }
    };
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ExtensionController as any).instance = undefined;
  });

  describe('activate', () => {
    it('should activate without errors', async () => {
      await expect(extension.activate(mockContext)).resolves.not.toThrow();
    });

    it('should log activation message', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      await extension.activate(mockContext);
      expect(consoleSpy).toHaveBeenCalledWith('mdMagic extension is now active!');
      consoleSpy.mockRestore();
    });

    it('should create and initialize ExtensionController', async () => {
      await extension.activate(mockContext);
      const controller = ExtensionController.getInstance();
      expect(controller).toBeDefined();
      expect(controller?.getIsInitialized()).toBe(true);
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

    it('should dispose ExtensionController if it exists', async () => {
      // First activate to create controller
      await extension.activate(mockContext);
      let controller = ExtensionController.getInstance();
      expect(controller).toBeDefined();
      
      const disposeSpy = jest.spyOn(controller!, 'dispose');
      
      // Then deactivate
      extension.deactivate();
      
      expect(disposeSpy).toHaveBeenCalled();
      controller = ExtensionController.getInstance();
      expect(controller).toBeUndefined();
    });
  });
});
