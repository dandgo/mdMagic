/**
 * Unit tests for WebviewProvider
 */

// Mock vscode first
const mockWebviewPanel = {
  webview: {
    html: '',
    onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
    postMessage: jest.fn()
  },
  onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeViewState: jest.fn(() => ({ dispose: jest.fn() })),
  title: 'Test Panel',
  active: true,
  visible: true,
  reveal: jest.fn(),
  dispose: jest.fn()
};

const mockUri = {
  fsPath: '/test/document.md',
  toString: () => 'file:///test/document.md'
};

const mockVscode = {
  window: {
    createWebviewPanel: jest.fn(() => mockWebviewPanel),
    registerWebviewPanelSerializer: jest.fn(() => ({ dispose: jest.fn() })),
    showErrorMessage: jest.fn()
  },
  ViewColumn: {
    One: 1
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, toString: () => `file://${path}` }))
  },
  commands: {
    executeCommand: jest.fn()
  },
  env: {
    openExternal: jest.fn()
  }
};

jest.mock('vscode', () => mockVscode);

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(() => Promise.resolve('<html>Test Template</html>'))
  }
}));

import { WebviewProvider } from '../providers/WebviewProvider';
import { EditorMode, MessageType } from '../types/webview';
import * as vscode from 'vscode';

// Mock VS Code API
const mockContext = {
  extensionPath: '/test/path',
  subscriptions: []
} as any;

describe('WebviewProvider', () => {
  let webviewProvider: WebviewProvider;

  beforeEach(() => {
    webviewProvider = new WebviewProvider(mockContext);
    jest.clearAllMocks();
  });

  afterEach(() => {
    webviewProvider.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(webviewProvider.initialize()).resolves.not.toThrow();
    });

    it('should have correct component properties', () => {
      expect(webviewProvider.id).toBe('webviewProvider');
      expect(webviewProvider.name).toBe('Webview Provider');
    });
  });

  describe('webview creation', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should create editor webview', async () => {
      const panel = await webviewProvider.createEditorWebview(mockUri as vscode.Uri, 'test content');
      
      expect(panel).toBe(mockWebviewPanel);
      expect(mockVscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.editor',
        expect.stringContaining('document.md'),
        mockVscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });

    it('should create viewer webview', async () => {
      const panel = await webviewProvider.createViewerWebview(mockUri as vscode.Uri, 'test content');
      
      expect(panel).toBe(mockWebviewPanel);
      expect(mockVscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.viewer',
        expect.stringContaining('document.md'),
        mockVscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true
        })
      );
    });

    it('should reuse existing webview for same document', async () => {
      const panel1 = await webviewProvider.createEditorWebview(mockUri as vscode.Uri);
      const panel2 = await webviewProvider.createEditorWebview(mockUri as vscode.Uri);
      
      expect(panel1).toBe(panel2);
      expect(mockWebviewPanel.reveal).toHaveBeenCalled();
    });

    it('should track active panels', async () => {
      await webviewProvider.createEditorWebview(mockUri as vscode.Uri);
      const panels = webviewProvider.getActivePanels();
      
      expect(panels).toHaveLength(1);
      expect(panels[0].mode).toBe(EditorMode.EDITOR);
      expect(panels[0].documentId).toContain('doc_');
    });
  });

  describe('webview management', () => {
    let panel: any;

    beforeEach(async () => {
      await webviewProvider.initialize();
      panel = await webviewProvider.createEditorWebview(mockUri as vscode.Uri, 'initial content');
    });

    it('should update webview content', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.updateWebviewContent(panelId, 'updated content');
      
      expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
        type: MessageType.CONTENT_CHANGED,
        payload: { content: 'updated content' }
      });
    });

    it('should handle webview disposal', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.disposeWebview(panelId);
      
      expect(mockWebviewPanel.dispose).toHaveBeenCalled();
      expect(webviewProvider.getActivePanels()).toHaveLength(0);
    });

    it('should get webview by document ID', () => {
      const panels = webviewProvider.getActivePanels();
      const documentId = panels[0].documentId;
      
      const foundPanel = webviewProvider.getWebviewByDocumentId(documentId);
      
      expect(foundPanel).toBeDefined();
      expect(foundPanel?.documentId).toBe(documentId);
    });
  });

  describe('message handling', () => {
    let panel: any;

    beforeEach(async () => {
      await webviewProvider.initialize();
      panel = await webviewProvider.createEditorWebview(mockUri as vscode.Uri, 'test content');
    });

    it('should handle webview ready message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.handleWebviewMessage({
        type: MessageType.WEBVIEW_READY,
        payload: {}
      }, panelId);
      
      // Should send initial content
      expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'setContent',
        payload: { content: 'test content' }
      });
    });

    it('should handle content changed message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.handleWebviewMessage({
        type: MessageType.CONTENT_CHANGED,
        payload: { content: 'new content', isDirty: true }
      }, panelId);
      
      const panelInfo = webviewProvider.getActivePanels()[0];
      expect(panelInfo.state.content).toBe('new content');
      expect(panelInfo.state.isDirty).toBe(true);
    });

    it('should handle save document message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.handleWebviewMessage({
        type: MessageType.SAVE_DOCUMENT,
        payload: { content: 'content to save' }
      }, panelId);
      
      const panelInfo = webviewProvider.getActivePanels()[0];
      expect(panelInfo.state.isDirty).toBe(false);
    });

    it('should handle execute command message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      webviewProvider.handleWebviewMessage({
        type: MessageType.EXECUTE_COMMAND,
        payload: { command: 'test.command', args: ['arg1'] }
      }, panelId);
      
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith('test.command', 'arg1');
    });
  });

  describe('state management', () => {
    let panel: any;

    beforeEach(async () => {
      await webviewProvider.initialize();
      panel = await webviewProvider.createEditorWebview(mockUri as vscode.Uri, 'test content');
    });

    it('should get webview state', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      const state = webviewProvider.getWebviewState(panelId);
      
      expect(state).toBeDefined();
      expect(state?.content).toBe('test content');
      expect(state?.mode).toBe(EditorMode.EDITOR);
    });

    it('should restore webview state', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      const newState = {
        documentId: 'test',
        mode: EditorMode.EDITOR,
        content: 'restored content',
        isDirty: false,
        lastModified: new Date()
      };
      
      webviewProvider.restoreWebviewState(panelId, newState);
      
      expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
        type: 'setContent',
        payload: { content: 'restored content' }
      });
    });
  });

  describe('disposal', () => {
    it('should dispose all resources', async () => {
      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(mockUri as vscode.Uri);
      
      webviewProvider.dispose();
      
      expect(webviewProvider.getActivePanels()).toHaveLength(0);
      expect(mockWebviewPanel.dispose).toHaveBeenCalled();
    });
  });
});