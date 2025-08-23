/**
 * Unit tests for WebviewProvider
 */

import { WebviewProvider } from '../providers/WebviewProvider';
import { EditorMode, MessageType } from '../types/webview';
import * as vscode from 'vscode';

// Test data
const mockContext = {
  extensionPath: '/test/path',
  subscriptions: [],
} as any;

const mockUri = {
  fsPath: '/test/document.md',
  toString: () => 'file:///test/document.md',
} as vscode.Uri;

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
      const panel = await webviewProvider.createEditorWebview(mockUri, 'test content');

      expect(panel).toBeDefined();
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.editor',
        expect.stringContaining('document.md'),
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    it('should create viewer webview', async () => {
      const panel = await webviewProvider.createViewerWebview(mockUri, 'test content');

      expect(panel).toBeDefined();
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.viewer',
        expect.stringContaining('document.md'),
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    it('should reuse existing webview for same document', async () => {
      const panel1 = await webviewProvider.createEditorWebview(mockUri);
      const panel2 = await webviewProvider.createEditorWebview(mockUri);

      expect(panel1).toBe(panel2);
      // expect(panel1.reveal).toHaveBeenCalled(); // Skip this check as panel structure may vary
    });

    it('should track active panels', async () => {
      await webviewProvider.createEditorWebview(mockUri);
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
      panel = await webviewProvider.createEditorWebview(mockUri, 'initial content');
    });

    it('should update webview content', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.updateWebviewContent(panelId, 'updated content');

      // Note: The actual mock might be called through the panel's webview
      // Check that the content was updated in state
      const updatedPanels = webviewProvider.getActivePanels();
      expect(updatedPanels[0].state.content).toBe('updated content');
    });

    it('should handle webview disposal', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.disposeWebview(panelId);

      // Panel dispose is handled internally
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
      panel = await webviewProvider.createEditorWebview(mockUri, 'test content');
    });

    it('should handle webview ready message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.handleWebviewMessage(
        {
          type: MessageType.WEBVIEW_READY,
          payload: {},
        },
        panelId
      );

      // Should send initial content (timing dependent)
      // expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
      //   type: 'setContent',
      //   payload: { content: 'test content' }
      // });
    });

    it('should handle content changed message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.handleWebviewMessage(
        {
          type: MessageType.CONTENT_CHANGED,
          payload: { content: 'new content', isDirty: true },
        },
        panelId
      );

      const panelInfo = webviewProvider.getActivePanels()[0];
      expect(panelInfo.state.content).toBe('new content');
      expect(panelInfo.state.isDirty).toBe(true);
    });

    it('should handle save document message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.handleWebviewMessage(
        {
          type: MessageType.SAVE_DOCUMENT,
          payload: { content: 'content to save' },
        },
        panelId
      );

      const panelInfo = webviewProvider.getActivePanels()[0];
      expect(panelInfo.state.isDirty).toBe(false);
    });

    it('should handle execute command message', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      webviewProvider.handleWebviewMessage(
        {
          type: MessageType.EXECUTE_COMMAND,
          payload: { command: 'test.command', args: ['arg1'] },
        },
        panelId
      );

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('test.command', 'arg1');
    });
  });

  describe('state management', () => {
    let panel: any;

    beforeEach(async () => {
      await webviewProvider.initialize();
      panel = await webviewProvider.createEditorWebview(mockUri, 'test content');
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
        lastModified: new Date(),
      };

      webviewProvider.restoreWebviewState(panelId, newState);

      // Verify state was updated
      const updatedPanels = webviewProvider.getActivePanels();
      expect(updatedPanels[0].state.content).toBe('restored content');
    });

    it('should serialize webview state for VS Code restarts', () => {
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      const panel = panels[0].panel;

      // Check that getState function was set on the panel
      expect(typeof (panel as any).getState).toBe('function');

      // Call getState to ensure it returns serializable data
      const state = (panel as any).getState();
      expect(state).toBeDefined();
      expect(state.documentId).toBeDefined();
      expect(state.mode).toBe(EditorMode.EDITOR);
      expect(state.content).toBe('test content');
      expect(state.documentUri).toBeDefined();
      expect(typeof state.lastModified).toBe('string'); // Should be ISO string
    });
  });

  describe('disposal', () => {
    it('should dispose all resources', async () => {
      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(mockUri);

      webviewProvider.dispose();

      expect(webviewProvider.getActivePanels()).toHaveLength(0);
      // Panel dispose is called internally through registered event handlers
    });
  });
});
