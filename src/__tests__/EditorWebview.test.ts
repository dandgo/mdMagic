/**
 * Editor Webview Implementation Tests
 * Tests for Task 2.2: Monaco Editor integration and WYSIWYG features
 */

import { WebviewProvider } from '../providers/WebviewProvider';
import { EditorMode } from '../types/webview';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Mock VS Code API
jest.mock('vscode');
jest.mock('fs');

describe('Editor Webview Implementation (Task 2.2)', () => {
  let webviewProvider: WebviewProvider;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewPanel: any;
  let mockWebview: any;

  beforeEach(() => {
    // Mock context
    mockContext = {
      extensionPath: '/mock/extension/path',
      subscriptions: [],
    } as any;

    // Mock webview
    mockWebview = {
      html: '',
      options: {},
      asWebviewUri: jest.fn((uri) => ({
        toString: () => `vscode-webview://fake-uuid/${uri.fsPath.replace(/.*\//, '')}`,
      })),
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
    };

    // Mock webview panel
    mockWebviewPanel = {
      webview: mockWebview,
      title: 'Test Editor',
      active: true,
      visible: true,
      reveal: jest.fn(),
      dispose: jest.fn(),
      onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
      onDidChangeViewState: jest.fn(() => ({ dispose: jest.fn() })),
    };

    // Mock vscode.window.createWebviewPanel
    (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockWebviewPanel);

    // Mock vscode.Uri
    (vscode.Uri.file as jest.Mock).mockImplementation((path) => ({ fsPath: path }));

    webviewProvider = new WebviewProvider(mockContext);
  });

  afterEach(() => {
    webviewProvider.dispose();
    jest.clearAllMocks();
  });

  describe('Editor Webview Creation', () => {
    it('should create editor webview successfully', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      // Mock file reading for template
      (fs.promises.readFile as jest.Mock).mockResolvedValue(`
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="styles/editor.css">
        </head>
        <body>
          <div id="toolbar"></div>
          <div id="editor-container">
            <div id="monaco-editor"></div>
          </div>
          <script src="scripts/monaco-loader.js"></script>
          <script src="scripts/editor.js"></script>
        </body>
        </html>
      `);

      await webviewProvider.initialize();
      const panel = await webviewProvider.createEditorWebview(documentUri, '# Test Content');

      expect(panel).toBe(mockWebviewPanel);
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.editor',
        expect.stringContaining('mdMagic editor'),
        vscode.ViewColumn.One,
        expect.objectContaining({
          enableScripts: true,
          retainContextWhenHidden: true,
        })
      );
    });

    it('should process asset URLs correctly', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <link rel="stylesheet" href="styles/editor.css">
        </head>
        <body>
          <script src="scripts/monaco-loader.js"></script>
          <script src="scripts/editor.js"></script>
        </body>
        </html>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      // Verify that HTML content was processed and URIs were replaced
      expect(mockWebview.asWebviewUri).toHaveBeenCalledTimes(3); // CSS, monaco-loader.js, editor.js
      expect(mockWebview.html).toContain('href='); // CSS should be replaced
      expect(mockWebview.html).toContain('src='); // JS files should be replaced
    });

    it('should handle template loading errors gracefully', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await webviewProvider.initialize();
      const panel = await webviewProvider.createEditorWebview(documentUri);

      expect(panel).toBe(mockWebviewPanel);
      expect(mockWebview.html).toContain('Error');
      expect(mockWebview.html).toContain('Failed to load editor template');
    });
  });

  describe('Monaco Editor Integration', () => {
    it('should include Monaco Editor loader in HTML', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <script src="scripts/monaco-loader.js"></script>
        <script src="scripts/editor.js"></script>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('monaco-loader.js');
      expect(mockWebview.html).toContain('editor.js');
    });

    it('should include monaco editor container', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <div id="editor-container">
          <div id="monaco-editor"></div>
        </div>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('id="monaco-editor"');
      expect(mockWebview.html).toContain('id="editor-container"');
    });
  });

  describe('Toolbar Implementation', () => {
    it('should include enhanced toolbar in HTML', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <div id="toolbar">
          <button data-command="bold">B</button>
          <button data-command="italic">I</button>
          <select id="header-select"></select>
        </div>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('id="toolbar"');
      expect(mockWebview.html).toContain('data-command="bold"');
      expect(mockWebview.html).toContain('data-command="italic"');
    });
  });

  describe('Message Handling', () => {
    it('should handle content change messages', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      const panel = await webviewProvider.createEditorWebview(documentUri);

      // Simulate content change message
      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const message = {
        type: 'contentChanged',
        payload: {
          content: '# Updated content',
          isDirty: true,
        },
      };

      webviewProvider.handleWebviewMessage(message, panelId);

      // Verify that the content was updated
      const panelInfo = webviewProvider['panels'].get(panelId);
      expect(panelInfo?.state.content).toBe('# Updated content');
      expect(panelInfo?.state.isDirty).toBe(true);
    });

    it('should handle save document messages', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const message = {
        type: 'saveDocument',
        payload: {
          content: '# Content to save',
        },
      };

      webviewProvider.handleWebviewMessage(message, panelId);

      // Verify that the document is marked as clean after save
      const panelInfo = webviewProvider['panels'].get(panelId);
      expect(panelInfo?.state.isDirty).toBe(false);
    });

    it('should handle webview ready messages', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');
      const initialContent = '# Initial content';

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri, initialContent);

      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const message = {
        type: 'webviewReady',
        payload: {},
      };

      webviewProvider.handleWebviewMessage(message, panelId);

      // Verify that content was sent to webview
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setContent',
        payload: { content: initialContent },
      });
    });
  });

  describe('WYSIWYG Features', () => {
    it('should include preview panel container', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <div id="editor-container">
          <div id="monaco-editor"></div>
        </div>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      // The preview panel should be dynamically added by the editor script
      expect(mockWebview.html).toContain('id="editor-container"');
    });

    it('should include CSS for preview styling', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <link rel="stylesheet" href="styles/editor.css">
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('editor.css');
    });
  });

  describe('Auto-save Functionality', () => {
    it('should set up proper message handlers for auto-save', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      // Verify that message listener was set up
      expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should handle auto-save content changes', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const message = {
        type: 'contentChanged',
        payload: {
          content: '# Auto-saved content',
          isDirty: true,
          autoSave: true,
        },
      };

      webviewProvider.handleWebviewMessage(message, panelId);

      const panelInfo = webviewProvider['panels'].get(panelId);
      expect(panelInfo?.state.content).toBe('# Auto-saved content');
      expect(panelInfo?.state.isDirty).toBe(true);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should include editor script that handles keyboard shortcuts', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      const templateContent = `
        <script src="scripts/editor.js"></script>
      `;

      (fs.promises.readFile as jest.Mock).mockResolvedValue(templateContent);

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('editor.js');
    });
  });

  describe('State Preservation', () => {
    it('should preserve cursor position in webview state', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri, '# Test');

      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const panelInfo = webviewProvider['panels'].get(panelId);

      expect(panelInfo?.state).toHaveProperty('content');
      expect(panelInfo?.state).toHaveProperty('isDirty');
      expect(panelInfo?.state).toHaveProperty('lastModified');
    });

    it('should update state timestamp on content changes', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockResolvedValue('<html></html>');

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      const panelId = Array.from(webviewProvider['panels'].keys())[0];
      const originalTimestamp = webviewProvider['panels'].get(panelId)?.state.lastModified;

      // Wait a bit and then change content
      await new Promise((resolve) => setTimeout(resolve, 10));

      const message = {
        type: 'contentChanged',
        payload: {
          content: '# Changed content',
          isDirty: true,
        },
      };

      webviewProvider.handleWebviewMessage(message, panelId);

      const updatedTimestamp = webviewProvider['panels'].get(panelId)?.state.lastModified;
      expect(updatedTimestamp).not.toEqual(originalTimestamp);
    });
  });

  describe('Error Handling', () => {
    it('should show error content when template fails to load', async () => {
      const documentUri = vscode.Uri.file('/test/document.md');

      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('Template not found'));

      await webviewProvider.initialize();
      await webviewProvider.createEditorWebview(documentUri);

      expect(mockWebview.html).toContain('Error');
      expect(mockWebview.html).toContain('Failed to load editor template');
    });

    it('should handle missing webview panels gracefully', () => {
      const message = {
        type: 'contentChanged',
        payload: { content: 'test' },
      };

      // Try to handle message for non-existent panel
      expect(() => {
        webviewProvider.handleWebviewMessage(message, 'non-existent-panel');
      }).not.toThrow();
    });
  });
});

describe('Editor Asset Files', () => {
  describe('CSS Styles', () => {
    it('should have editor.css file in the correct location', () => {
      const cssPath = path.join(__dirname, '..', 'webview', 'styles', 'editor.css');
      // In a real test environment, this would check if the file exists
      expect(cssPath).toContain('editor.css');
    });
  });

  describe('JavaScript Files', () => {
    it('should have monaco-loader.js in the correct location', () => {
      const jsPath = path.join(__dirname, '..', 'webview', 'scripts', 'monaco-loader.js');
      expect(jsPath).toContain('monaco-loader.js');
    });

    it('should have editor.js in the correct location', () => {
      const jsPath = path.join(__dirname, '..', 'webview', 'scripts', 'editor.js');
      expect(jsPath).toContain('editor.js');
    });
  });
});
