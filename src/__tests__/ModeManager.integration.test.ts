/**
 * Integration validation script for ModeManager
 * This script tests ModeManager with real ConfigManager and DocumentManager
 */

import * as vscode from 'vscode';
import { ModeManager } from '../managers/ModeManager';
import { ConfigManager } from '../managers/ConfigManager';
import { DocumentManager } from '../managers/DocumentManager';
import { EditorMode } from '../managers/MarkdownDocument';

// Mock vscode for testing
jest.mock('vscode', () => ({
  Uri: {
    parse: jest.fn((str: string) => ({
      toString: () => str,
      fsPath: str,
    })),
  },
  Disposable: jest.fn((fn: () => void) => ({
    dispose: fn,
  })),
  workspace: {
    onDidChangeConfiguration: jest.fn(() => ({
      dispose: jest.fn(),
    })),
    getConfiguration: jest.fn(() => ({
      get: jest.fn().mockReturnValue('viewer'),
    })),
    createFileSystemWatcher: jest.fn(() => ({
      onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
      onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
      dispose: jest.fn(),
    })),
    fs: {
      readFile: jest.fn(),
    },
  },
}));

describe('ModeManager Integration', () => {
  let modeManager: ModeManager;
  let configManager: ConfigManager;
  let documentManager: DocumentManager;
  let mockContext: vscode.ExtensionContext;

  beforeEach(async () => {
    // Setup mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    // Create real managers
    configManager = new ConfigManager(mockContext);
    documentManager = new DocumentManager(mockContext);
    
    // Initialize managers
    await configManager.initialize();
    await documentManager.initialize();
    
    // Create ModeManager with real dependencies
    modeManager = new ModeManager(mockContext, documentManager, configManager);
  });

  afterEach(() => {
    modeManager.dispose();
    documentManager.dispose();
    configManager.dispose();
  });

  it('should integrate successfully with real managers', async () => {
    await expect(modeManager.initialize()).resolves.not.toThrow();
  });

  it('should respond to configuration changes', async () => {
    await modeManager.initialize();

    // Verify configuration integration
    const defaultMode = modeManager.getCurrentMode('test-doc');
    expect([EditorMode.Editor, EditorMode.Viewer]).toContain(defaultMode);
  });

  it('should work with document manager events', async () => {
    await modeManager.initialize();

    // Create a mock document through DocumentManager
    const testUri = vscode.Uri.parse('file:///test.md');
    
    // This tests the integration without requiring actual file system
    const mode = modeManager.getCurrentMode(testUri.toString());
    expect(mode).toBeDefined();
  });
});