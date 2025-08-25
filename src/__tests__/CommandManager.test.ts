/**
 * CommandManager Tests
 */

import * as vscode from 'vscode';
import { CommandManager, CommandDefinition } from '../managers/CommandManager';

// Mock VS Code API
jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn((id: string, handler: Function) => ({
      dispose: jest.fn(),
    })),
  },
  window: {
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    activeTextEditor: null,
  },
  workspace: {
    openTextDocument: jest.fn(),
  },
}));

// Mock ExtensionController
jest.mock('../controllers/ExtensionController', () => ({
  ExtensionController: {
    getInstance: jest.fn(() => ({
      getComponent: jest.fn(),
    })),
  },
}));

describe('CommandManager', () => {
  let commandManager: CommandManager;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    // Setup mock context
    mockContext = {
      subscriptions: [],
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    commandManager = new CommandManager(mockContext);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (commandManager) {
      commandManager.dispose();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await commandManager.initialize();

      expect(commandManager.getAvailableCommands()).toContain('mdMagic.toggleMode');
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.switchToEditor');
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.switchToViewer');
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.formatBold');
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.formatItalic');
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.insertLink');
    });

    it('should register commands with VS Code', async () => {
      await commandManager.initialize();

      // Should register at least 9 commands (7 new + 2 legacy)
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(9);
    });

    it('should handle multiple initialization calls', async () => {
      await commandManager.initialize();
      await commandManager.initialize(); // Second call should not re-initialize

      expect(commandManager.getAvailableCommands().length).toBeGreaterThan(0);
    });
  });

  describe('command registration', () => {
    it('should register a custom command', async () => {
      await commandManager.initialize();

      const customCommand: CommandDefinition = {
        id: 'mdMagic.testCommand',
        title: 'Test Command',
        category: 'mdMagic',
        handler: {
          execute: jest.fn().mockResolvedValue('test result'),
        },
      };

      const disposable = commandManager.registerCommand(customCommand);

      expect(commandManager.isCommandAvailable('mdMagic.testCommand')).toBe(true);
      expect(commandManager.getAvailableCommands()).toContain('mdMagic.testCommand');
      expect(disposable).toHaveProperty('dispose');
    });

    it('should handle duplicate command registration', async () => {
      await commandManager.initialize();

      const command: CommandDefinition = {
        id: 'mdMagic.duplicate',
        title: 'Duplicate Command',
        category: 'mdMagic',
        handler: {
          execute: jest.fn(),
        },
      };

      commandManager.registerCommand(command);
      const secondDisposable = commandManager.registerCommand(command);

      // Should still have the command but return a no-op disposable
      expect(commandManager.isCommandAvailable('mdMagic.duplicate')).toBe(true);
      expect(secondDisposable.dispose).toBeDefined();
    });
  });

  describe('command execution', () => {
    it('should execute a registered command', async () => {
      await commandManager.initialize();

      const mockHandler = jest.fn().mockResolvedValue('executed');
      const command: CommandDefinition = {
        id: 'mdMagic.execTest',
        title: 'Execution Test',
        category: 'mdMagic',
        handler: {
          execute: mockHandler,
          canExecute: jest.fn().mockReturnValue(true),
        },
      };

      commandManager.registerCommand(command);
      const result = await commandManager.executeCommand('mdMagic.execTest', ['arg1']);

      expect(mockHandler).toHaveBeenCalledWith(['arg1']);
      expect(result).toBe('executed');
    });

    it('should throw error for non-existent command', async () => {
      await commandManager.initialize();

      await expect(commandManager.executeCommand('mdMagic.nonExistent')).rejects.toThrow(
        'Command mdMagic.nonExistent not found'
      );
    });

    it('should respect canExecute condition', async () => {
      await commandManager.initialize();

      const command: CommandDefinition = {
        id: 'mdMagic.conditionalTest',
        title: 'Conditional Test',
        category: 'mdMagic',
        handler: {
          execute: jest.fn(),
          canExecute: jest.fn().mockReturnValue(false),
        },
      };

      commandManager.registerCommand(command);

      await expect(commandManager.executeCommand('mdMagic.conditionalTest')).rejects.toThrow(
        'Command mdMagic.conditionalTest cannot execute in current context'
      );
    });
  });

  describe('command validation', () => {
    it('should check if command is available', async () => {
      await commandManager.initialize();

      expect(commandManager.isCommandAvailable('mdMagic.toggleMode')).toBe(true);
      expect(commandManager.isCommandAvailable('mdMagic.nonExistent')).toBe(false);
    });

    it('should return list of available commands', async () => {
      await commandManager.initialize();

      const commands = commandManager.getAvailableCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('mdMagic.toggleMode');
    });
  });

  describe('disposal', () => {
    it('should dispose all resources', async () => {
      await commandManager.initialize();

      const commandCount = commandManager.getAvailableCommands().length;
      expect(commandCount).toBeGreaterThan(0);

      commandManager.dispose();

      expect(commandManager.getAvailableCommands().length).toBe(0);
      expect(commandManager.isCommandAvailable('mdMagic.toggleMode')).toBe(false);
    });
  });
});
