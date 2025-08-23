/**
 * Unit tests for ExtensionController
 */

// Mock VS Code API first
const mockVscode = {
  ExtensionContext: jest.fn(),
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
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

jest.mock('vscode', () => mockVscode, { virtual: true });

import { ExtensionController, Component } from '../controllers/ExtensionController';

describe('ExtensionController', () => {
  let mockContext: any;
  let controller: ExtensionController;

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
    };
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ExtensionController as any).instance = undefined;
    
    controller = new ExtensionController(mockContext);
  });

  afterEach(() => {
    if (controller) {
      controller.dispose();
    }
  });

  describe('constructor', () => {
    it('should create instance and set singleton', () => {
      expect(controller).toBeDefined();
      expect(ExtensionController.getInstance()).toBe(controller);
    });

    it('should store context', () => {
      expect(controller.getContext()).toBe(mockContext);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await controller.initialize();
      
      expect(controller.getIsInitialized()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic] Initializing mdMagic extension controller...');
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic] mdMagic extension controller initialized successfully');
      
      consoleSpy.mockRestore();
    });

    it('should not initialize twice', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await controller.initialize();
      await controller.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic] Extension controller already initialized');
      
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Test initialization error');
      
      // Mock workspace.onDidChangeConfiguration to throw error
      mockVscode.workspace.onDidChangeConfiguration.mockImplementationOnce(() => {
        throw mockError;
      });
      
      await expect(controller.initialize()).rejects.toThrow('Test initialization error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mdMagic Error] Failed to initialize extension controller: Test initialization error')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('component registration', () => {
    let mockComponent: Component;

    beforeEach(() => {
      mockComponent = {
        id: 'test-component',
        name: 'Test Component',
        initialize: jest.fn().mockResolvedValue(void 0),
        dispose: jest.fn(),
      };
    });

    it('should register component successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await controller.registerComponent(mockComponent);
      
      expect(mockComponent.initialize).toHaveBeenCalled();
      expect(controller.getComponent('test-component')).toBe(mockComponent);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mdMagic] Component Test Component (test-component) registered successfully'
      );
      
      consoleSpy.mockRestore();
    });

    it('should not register duplicate components', async () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      
      await controller.registerComponent(mockComponent);
      await controller.registerComponent(mockComponent);
      
      expect(mockComponent.initialize).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mdMagic Warning] Component test-component is already registered'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle component initialization errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Component init error');
      mockComponent.initialize = jest.fn().mockRejectedValue(mockError);
      
      await expect(controller.registerComponent(mockComponent)).rejects.toThrow('Component init error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mdMagic Error] Failed to register component Test Component: Component init error')
      );
      
      consoleSpy.mockRestore();
    });

    it('should return components map', async () => {
      await controller.registerComponent(mockComponent);
      
      const components = controller.getComponents();
      expect(components.size).toBe(1);
      expect(components.get('test-component')).toBe(mockComponent);
      
      // Should return a copy, not the original map
      components.clear();
      expect(controller.getComponents().size).toBe(1);
    });
  });

  describe('disposal', () => {
    it('should dispose cleanly', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      controller.dispose();
      
      expect(controller.getIsInitialized()).toBe(false);
      expect(ExtensionController.getInstance()).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic] mdMagic extension controller disposed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should dispose all components', async () => {
      const mockComponent = {
        id: 'test-component',
        name: 'Test Component',
        initialize: jest.fn().mockResolvedValue(void 0),
        dispose: jest.fn(),
      };
      
      await controller.registerComponent(mockComponent);
      
      controller.dispose();
      
      expect(mockComponent.dispose).toHaveBeenCalled();
      expect(controller.getComponents().size).toBe(0);
    });

    it('should handle component disposal errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockComponent = {
        id: 'test-component',
        name: 'Test Component',
        initialize: jest.fn().mockResolvedValue(void 0),
        dispose: jest.fn(() => { throw new Error('Disposal error'); }),
      };
      
      await controller.registerComponent(mockComponent);
      
      controller.dispose();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mdMagic Error] Failed to dispose component Test Component: Disposal error')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should log errors with context', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Test error');
      
      // Access private method through any cast for testing
      (controller as any).handleError(mockError, 'Test context');
      
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic Error] Test context: Test error');
      
      consoleSpy.mockRestore();
    });

    it('should log error stack when available', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const mockError = new Error('Test error');
      mockError.stack = 'Test stack trace';
      
      (controller as any).handleError(mockError);
      
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic Error] Test error');
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic Error Stack] Test stack trace');
      
      consoleSpy.mockRestore();
    });

    it('should show user error for critical failures', () => {
      const mockError = new Error('Critical error');
      
      (controller as any).handleError(mockError, 'Failed to initialize something');
      
      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        'mdMagic: Failed to initialize something: Critical error'
      );
    });
  });

  describe('logging', () => {
    it('should log info messages', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      (controller as any).logInfo('Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic] Test message');
      consoleSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      
      (controller as any).logWarning('Test warning');
      
      expect(consoleSpy).toHaveBeenCalledWith('[mdMagic Warning] Test warning');
      consoleSpy.mockRestore();
    });
  });

  describe('event listeners', () => {
    it('should setup configuration change listener', async () => {
      await controller.initialize();
      
      expect(mockVscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });
  });
});