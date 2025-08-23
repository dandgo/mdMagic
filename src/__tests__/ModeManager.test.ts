/**
 * ModeManager Tests
 */

import { ModeManager, IModeManager, ModeChangeEvent, DocumentModeState } from '../managers/ModeManager';
import { EditorMode } from '../managers/MarkdownDocument';
import { IDocumentManager } from '../managers/DocumentManager';
import { IConfigManager } from '../managers/ConfigManager';
import * as vscode from 'vscode';

// Mock vscode
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
}));

describe('ModeManager', () => {
  let modeManager: IModeManager;
  let mockContext: vscode.ExtensionContext;
  let mockDocumentManager: jest.Mocked<IDocumentManager>;
  let mockConfigManager: jest.Mocked<IConfigManager>;
  let mockDocument: any;

  const testDocumentId = 'file:///test/document.md';

  beforeEach(() => {
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

    // Setup mock document
    mockDocument = {
      id: testDocumentId,
      uri: { toString: () => testDocumentId },
      mode: EditorMode.Viewer,
      cursorPosition: { line: 0, character: 0 },
      scrollPosition: 0,
      updateCursorPosition: jest.fn(),
      updateScrollPosition: jest.fn(),
    };

    // Setup mock document manager
    mockDocumentManager = {
      id: 'document-manager',
      name: 'Document Manager',
      initialize: jest.fn(),
      dispose: jest.fn(),
      getDocument: jest.fn().mockReturnValue(mockDocument),
      addChangeListener: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    } as any;

    // Setup mock config manager
    mockConfigManager = {
      id: 'config-manager',
      name: 'Config Manager',
      initialize: jest.fn(),
      dispose: jest.fn(),
      getConfigurationValue: jest.fn().mockReturnValue('viewer'),
      getConfiguration: jest.fn().mockReturnValue({
        defaultMode: 'viewer',
        autoSave: true,
        previewTheme: 'default',
        enableMath: true,
        showToolbar: true,
      }),
      addChangeListener: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    } as any;

    modeManager = new ModeManager(mockContext, mockDocumentManager, mockConfigManager);
  });

  afterEach(() => {
    modeManager.dispose();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(modeManager.initialize()).resolves.not.toThrow();
    });

    it('should setup configuration change listeners', async () => {
      await modeManager.initialize();
      expect(mockConfigManager.addChangeListener).toHaveBeenCalled();
    });

    it('should setup document change listeners', async () => {
      await modeManager.initialize();
      expect(mockDocumentManager.addChangeListener).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await modeManager.initialize();
      await modeManager.initialize();
      expect(mockConfigManager.addChangeListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentMode', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should return default mode for new document', () => {
      const mode = modeManager.getCurrentMode(testDocumentId);
      expect(mode).toBe(EditorMode.Viewer);
    });

    it('should return stored mode for tracked document', async () => {
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      const mode = modeManager.getCurrentMode(testDocumentId);
      expect(mode).toBe(EditorMode.Editor);
    });

    it('should return editor mode when default is editor', () => {
      mockConfigManager.getConfigurationValue.mockReturnValue('editor');
      const mode = modeManager.getCurrentMode('new-document');
      expect(mode).toBe(EditorMode.Editor);
    });
  });

  describe('switchMode', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should switch from viewer to editor mode', async () => {
      const initialMode = modeManager.getCurrentMode(testDocumentId);
      expect(initialMode).toBe(EditorMode.Viewer);

      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      const newMode = modeManager.getCurrentMode(testDocumentId);
      expect(newMode).toBe(EditorMode.Editor);
    });

    it('should update document mode property', async () => {
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      expect(mockDocument.mode).toBe(EditorMode.Editor);
    });

    it('should preserve cursor position during mode switch', async () => {
      mockDocument.cursorPosition = { line: 5, character: 10 };
      
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      expect(mockDocument.updateCursorPosition).toHaveBeenCalledWith({ line: 5, character: 10 });
    });

    it('should preserve scroll position during mode switch', async () => {
      mockDocument.scrollPosition = 100;
      
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      expect(mockDocument.updateScrollPosition).toHaveBeenCalledWith(100);
    });

    it('should not switch if already in target mode', async () => {
      await modeManager.switchMode(testDocumentId, EditorMode.Viewer);
      
      // Should already be in viewer mode
      const mode = modeManager.getCurrentMode(testDocumentId);
      expect(mode).toBe(EditorMode.Viewer);
    });

    it('should notify mode change listeners', async () => {
      const listener = jest.fn();
      modeManager.registerModeChangeListener(listener);
      
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: testDocumentId,
          previousMode: EditorMode.Viewer,
          currentMode: EditorMode.Editor,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should handle document not found gracefully', async () => {
      mockDocumentManager.getDocument.mockReturnValue(undefined);
      
      await expect(modeManager.switchMode('nonexistent', EditorMode.Editor)).resolves.not.toThrow();
    });
  });

  describe('canSwitchMode', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should return true for existing document', () => {
      const canSwitch = modeManager.canSwitchMode(testDocumentId, EditorMode.Editor);
      expect(canSwitch).toBe(true);
    });

    it('should return false for non-existent document', () => {
      mockDocumentManager.getDocument.mockReturnValue(undefined);
      const canSwitch = modeManager.canSwitchMode('nonexistent', EditorMode.Editor);
      expect(canSwitch).toBe(false);
    });
  });

  describe('Mode Change Listeners', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should register mode change listener', () => {
      const listener = jest.fn();
      const disposable = modeManager.registerModeChangeListener(listener);
      
      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');
    });

    it('should remove listener when disposed', async () => {
      const listener = jest.fn();
      const disposable = modeManager.registerModeChangeListener(listener);
      
      disposable.dispose();
      
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      modeManager.registerModeChangeListener(listener1);
      modeManager.registerModeChangeListener(listener2);
      
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();
      
      modeManager.registerModeChangeListener(errorListener);
      modeManager.registerModeChangeListener(normalListener);
      
      await expect(modeManager.switchMode(testDocumentId, EditorMode.Editor)).resolves.not.toThrow();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('getDocumentModeState', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should return undefined for untracked document', () => {
      const state = modeManager.getDocumentModeState('untracked');
      expect(state).toBeUndefined();
    });

    it('should return mode state for tracked document', async () => {
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      
      const state = modeManager.getDocumentModeState(testDocumentId);
      expect(state).toEqual(
        expect.objectContaining({
          documentId: testDocumentId,
          mode: EditorMode.Editor,
          lastSwitched: expect.any(Date),
        })
      );
    });
  });

  describe('setDefaultMode', () => {
    beforeEach(async () => {
      await modeManager.initialize();
    });

    it('should set document to configured default mode', async () => {
      mockConfigManager.getConfigurationValue.mockReturnValue('editor');
      
      await modeManager.setDefaultMode(testDocumentId);
      
      const mode = modeManager.getCurrentMode(testDocumentId);
      expect(mode).toBe(EditorMode.Editor);
    });

    it('should handle viewer as default mode', async () => {
      mockConfigManager.getConfigurationValue.mockReturnValue('viewer');
      
      await modeManager.setDefaultMode(testDocumentId);
      
      const mode = modeManager.getCurrentMode(testDocumentId);
      expect(mode).toBe(EditorMode.Viewer);
    });
  });

  describe('Multiple Documents', () => {
    const doc1Id = 'file:///test/doc1.md';
    const doc2Id = 'file:///test/doc2.md';

    beforeEach(async () => {
      await modeManager.initialize();
      
      // Setup mock documents
      mockDocumentManager.getDocument.mockImplementation((uri) => {
        const id = uri.toString();
        return {
          id,
          uri,
          mode: EditorMode.Viewer,
          cursorPosition: { line: 0, character: 0 },
          scrollPosition: 0,
          updateCursorPosition: jest.fn(),
          updateScrollPosition: jest.fn(),
        };
      });
    });

    it('should track modes independently for multiple documents', async () => {
      await modeManager.switchMode(doc1Id, EditorMode.Editor);
      await modeManager.switchMode(doc2Id, EditorMode.Viewer);
      
      expect(modeManager.getCurrentMode(doc1Id)).toBe(EditorMode.Editor);
      expect(modeManager.getCurrentMode(doc2Id)).toBe(EditorMode.Viewer);
    });

    it('should preserve state independently for multiple documents', async () => {
      // Switch both documents to different modes to create state objects
      await modeManager.switchMode(doc1Id, EditorMode.Editor);
      await modeManager.switchMode(doc2Id, EditorMode.Split);
      
      const doc1State = modeManager.getDocumentModeState(doc1Id);
      const doc2State = modeManager.getDocumentModeState(doc2Id);
      
      // States should be independent
      expect(doc1State).toBeDefined();
      expect(doc2State).toBeDefined();
      expect(doc1State).not.toBe(doc2State);
      expect(doc1State?.mode).toBe(EditorMode.Editor);
      expect(doc2State?.mode).toBe(EditorMode.Split);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      await modeManager.initialize();
      
      const listener = jest.fn();
      modeManager.registerModeChangeListener(listener);
      
      modeManager.dispose();
      
      // Should not receive notifications after disposal
      await modeManager.switchMode(testDocumentId, EditorMode.Editor);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});