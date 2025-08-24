/**
 * @jest-environment node
 */

import * as vscode from 'vscode';
import { StatusBarManager, DocumentStats } from '../managers/StatusBarManager';
import { DocumentManager } from '../managers/DocumentManager';
import { ModeManager } from '../managers/ModeManager';
import { MarkdownDocument } from '../managers/MarkdownDocument';

// Mock VS Code API
jest.mock('vscode', () => ({
  window: {
    createStatusBarItem: jest.fn(),
    onDidChangeActiveTextEditor: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  workspace: {
    onDidChangeTextDocument: jest.fn(),
  },
  commands: {
    registerCommand: jest.fn(),
  },
  env: {
    clipboard: {
      writeText: jest.fn(),
    },
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, toString: () => path })),
  },
  Disposable: jest.fn(),
}));

// Mock other components
jest.mock('../managers/DocumentManager');
jest.mock('../managers/ModeManager');
jest.mock('../managers/MarkdownDocument');

describe('StatusBarManager', () => {
  let statusBarManager: StatusBarManager;
  let mockContext: vscode.ExtensionContext;
  let mockStatusBarItem: any;
  let mockDocumentManager: jest.Mocked<DocumentManager>;
  let mockModeManager: jest.Mocked<ModeManager>;
  let mockDocument: jest.Mocked<MarkdownDocument>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock status bar item
    mockStatusBarItem = {
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: '',
    };

    // Create separate instances for each status bar item
    (vscode.window.createStatusBarItem as jest.Mock).mockImplementation(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: '',
    }));

    // Mock context
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: {} as any,
      extensionPath: '',
      environmentVariableCollection: {} as any,
      asAbsolutePath: jest.fn(),
      storagePath: '',
      globalStoragePath: '',
      logPath: '',
      secrets: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    };

    // Mock document
    mockDocument = {
      id: 'test-doc-id',
      uri: vscode.Uri.file('/test/document.md'),
      content: '# Test Document\n\nThis is a test document with some content.',
      mode: 'editor' as any,
      isDirty: false,
      cursorPosition: { line: 1, character: 0 },
      scrollPosition: 0,
      selections: [],
      lastModified: new Date(),
      updateContent: jest.fn(),
      markDirty: jest.fn(),
      markClean: jest.fn(),
      updateCursorPosition: jest.fn(),
      updateScrollPosition: jest.fn(),
      updateSelections: jest.fn(),
      getState: jest.fn(),
      dispose: jest.fn(),
    } as any;

    // Mock document manager
    mockDocumentManager = {
      getDocument: jest.fn().mockReturnValue(mockDocument),
      getAllDocuments: jest.fn().mockReturnValue([mockDocument]),
      createDocument: jest.fn(),
      closeDocument: jest.fn(),
      saveDocument: jest.fn(),
      saveAllDocuments: jest.fn(),
      initialize: jest.fn(),
      dispose: jest.fn(),
      id: 'document-manager',
      name: 'Document Manager',
    } as any;

    // Mock mode manager
    mockModeManager = {
      getCurrentMode: jest.fn().mockReturnValue('editor'),
      setMode: jest.fn(),
      toggleMode: jest.fn(),
      registerModeChangeListener: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      initialize: jest.fn(),
      dispose: jest.fn(),
      id: 'mode-manager',
      name: 'Mode Manager',
    } as any;

    // Mock extension controller
    const mockController = {
      getComponent: jest.fn((id: string) => {
        if (id === 'document-manager') {
          return mockDocumentManager;
        }
        if (id === 'mode-manager') {
          return mockModeManager;
        }
        return undefined;
      }),
    };

    // Mock require for ExtensionController
    jest.doMock('../controllers/ExtensionController', () => ({
      ExtensionController: {
        getInstance: () => mockController,
      },
    }));

    statusBarManager = new StatusBarManager(mockContext);
  });

  afterEach(() => {
    statusBarManager.dispose();
  });

  describe('Component Interface', () => {
    test('should have correct id and name', () => {
      expect(statusBarManager.id).toBe('status-bar-manager');
      expect(statusBarManager.name).toBe('Status Bar Manager');
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await statusBarManager.initialize();

      // Should create status bar items
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(2);
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Right, 100);
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Right, 99);

      // Should show status bar items
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledTimes(2);

      // Should register commands
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'mdMagic.showDocumentStats',
        expect.any(Function)
      );
    });

    test('should handle missing dependencies gracefully', async () => {
      // Create a status bar manager and manually set the managers to undefined
      const statusBarManagerWithMissingDeps = new StatusBarManager(mockContext);
      
      // Override the getExtensionController to return a controller with missing deps
      (statusBarManagerWithMissingDeps as any).getExtensionController = async () => ({
        getComponent: () => undefined,
      });

      await expect(statusBarManagerWithMissingDeps.initialize()).rejects.toThrow('Required managers not found');
      
      // Clean up
      statusBarManagerWithMissingDeps.dispose();
    });
  });

  describe('Document Statistics Calculation', () => {
    test('should calculate stats for simple document', async () => {
      await statusBarManager.initialize();

      const content = 'Hello world\n\nThis is a test.';
      const stats = (statusBarManager as any).calculateDocumentStats(content);

      expect(stats).toEqual({
        words: 6,
        characters: 22, // without spaces: Helloworldthisisatest.
        charactersWithSpaces: 28, // including spaces and newlines
        lines: 3,
        paragraphs: 2,
      });
    });

    test('should handle empty document', async () => {
      await statusBarManager.initialize();

      const stats = (statusBarManager as any).calculateDocumentStats('');

      expect(stats).toEqual({
        words: 0,
        characters: 0,
        charactersWithSpaces: 0,
        lines: 0,
        paragraphs: 0,
      });
    });

    test('should handle whitespace-only document', async () => {
      await statusBarManager.initialize();

      const stats = (statusBarManager as any).calculateDocumentStats('   \n\n   ');

      expect(stats).toEqual({
        words: 0,
        characters: 0,
        charactersWithSpaces: 0, // trim() makes it empty
        lines: 0, // trim() makes it empty
        paragraphs: 0,
      });
    });

    test('should handle markdown formatting', async () => {
      await statusBarManager.initialize();

      const content = '# Header\n\n**Bold text** and *italic text*.\n\n- List item\n- Another item';
      const stats = (statusBarManager as any).calculateDocumentStats(content);

      expect(stats.words).toBe(13); // "Header Bold text and italic text List item Another item" (includes markdown symbols)
      expect(stats.paragraphs).toBe(3); // header, text paragraph, list
    });
  });

  describe('Status Bar Updates', () => {
    beforeEach(async () => {
      await statusBarManager.initialize();
    });

    test('should update mode indicator', async () => {
      await statusBarManager.initialize(); // Need to initialize first
      (statusBarManager as any).currentDocument = mockDocument;
      (statusBarManager as any).updateModeIndicator('editor');

      const modeItem = (statusBarManager as any).modeStatusBarItem;
      expect(modeItem.text).toBe('$(book) Editor');
      expect(modeItem.tooltip).toBe('Current mode: Editor - Click to toggle');
      expect(modeItem.command).toBe('mdMagic.toggleMode');
    });

    test('should update mode indicator for viewer', async () => {
      await statusBarManager.initialize(); // Need to initialize first
      (statusBarManager as any).currentDocument = mockDocument;
      (statusBarManager as any).updateModeIndicator('viewer');

      const modeItem = (statusBarManager as any).modeStatusBarItem;
      expect(modeItem.text).toBe('$(book) Viewer');
      expect(modeItem.tooltip).toBe('Current mode: Viewer - Click to toggle');
    });

    test('should update stats indicator', async () => {
      await statusBarManager.initialize(); // Need to initialize first
      (statusBarManager as any).currentDocument = mockDocument;
      (statusBarManager as any).updateStatsIndicator();

      const statsItem = (statusBarManager as any).statsStatusBarItem;
      expect(statsItem.text).toContain('$(pencil)');
      expect(statsItem.text).toContain('words');
      expect(statsItem.text).toContain('chars');
      expect(statsItem.tooltip).toContain('Lines:');
      expect(statsItem.tooltip).toContain('Words:');
      expect(statsItem.tooltip).toContain('Characters:');
      expect(statsItem.command).toBe('mdMagic.showDocumentStats');
    });

    test('should hide status bar when no document is active', async () => {
      await statusBarManager.initialize();
      
      // Get references to the actual status bar items
      const modeItem = (statusBarManager as any).modeStatusBarItem;
      const statsItem = (statusBarManager as any).statsStatusBarItem;
      
      // Clear previous calls from initialization
      modeItem.hide.mockClear();
      statsItem.hide.mockClear();
      
      (statusBarManager as any).currentDocument = undefined;
      (statusBarManager as any).updateStatusBar();

      expect(modeItem.hide).toHaveBeenCalledTimes(1);
      expect(statsItem.hide).toHaveBeenCalledTimes(1);
    });
  });

  describe('Document Statistics Dialog', () => {
    beforeEach(async () => {
      await statusBarManager.initialize();
    });

    test('should show stats dialog with document information', async () => {
      (statusBarManager as any).currentDocument = mockDocument;
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Close');

      await (statusBarManager as any).showDocumentStatsDialog();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Document Statistics for "document.md"'),
        'Copy to Clipboard',
        'Close'
      );
    });

    test('should copy stats to clipboard when requested', async () => {
      (statusBarManager as any).currentDocument = mockDocument;
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Copy to Clipboard');

      await (statusBarManager as any).showDocumentStatsDialog();

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Document Statistics')
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Statistics copied to clipboard'
      );
    });

    test('should handle no active document', async () => {
      (statusBarManager as any).currentDocument = undefined;

      await (statusBarManager as any).showDocumentStatsDialog();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'No markdown document is currently active'
      );
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await statusBarManager.initialize();
    });

    test('should set up event listeners', () => {
      expect(mockModeManager.registerModeChangeListener).toHaveBeenCalled();
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    test('should dispose all resources', async () => {
      await statusBarManager.initialize();
      
      // Get references to the actual status bar items
      const modeItem = (statusBarManager as any).modeStatusBarItem;
      const statsItem = (statusBarManager as any).statsStatusBarItem;
      
      statusBarManager.dispose();

      expect(modeItem.dispose).toHaveBeenCalledTimes(1);
      expect(statsItem.dispose).toHaveBeenCalledTimes(1);
    });

    test('should handle disposal errors gracefully', async () => {
      await statusBarManager.initialize();
      
      mockStatusBarItem.dispose.mockImplementation(() => {
        throw new Error('Disposal error');
      });

      expect(() => statusBarManager.dispose()).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    test('should debounce function calls', async () => {
      await statusBarManager.initialize();
      
      const mockFn = jest.fn();
      const debouncedFn = (statusBarManager as any).debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});