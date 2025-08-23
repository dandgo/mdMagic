/**
 * Unit tests for Enhanced Viewer Webview Implementation (Task 2.3)
 * Tests for viewer creation, asset processing, and message handling
 */

import { WebviewProvider } from '../providers/WebviewProvider';
import { EditorMode } from '../types/webview';
import * as vscode from 'vscode';

// Test data
const mockContext = {
  extensionPath: '/test/path',
  subscriptions: [],
} as any;

const mockUri = {
  fsPath: '/test/viewer-test.md',
  toString: () => 'file:///test/viewer-test.md',
} as vscode.Uri;

// Test markdown content
const testMarkdownContent = `# Test Document

## Code Highlighting Test

\`\`\`javascript
function example() {
  console.log("Hello, world!");
}
\`\`\`

### Links and Formatting

This is **bold** and *italic* text with a [link](https://example.com).

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

#### Fourth Level Header

More content here.
`;

describe('Enhanced Viewer Webview Implementation (Task 2.3)', () => {
  let webviewProvider: WebviewProvider;

  beforeEach(() => {
    webviewProvider = new WebviewProvider(mockContext);
    jest.clearAllMocks();
  });

  afterEach(() => {
    webviewProvider.dispose();
  });

  describe('Viewer Webview Creation', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should create viewer webview successfully', async () => {
      const panel = await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      expect(panel).toBeDefined();
      expect(panel.webview.html).toBeDefined();
      
      // Verify the correct parameters were passed to createWebviewPanel
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.viewer',
        expect.stringContaining('viewer-test.md'),
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should create viewer webview with correct view type', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      // Verify createWebviewPanel was called with viewer type
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'mdMagic.viewer',
        expect.stringContaining('viewer-test.md'),
        expect.any(Number),
        expect.any(Object)
      );
    });

    it('should set up proper webview options', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      // Verify webview options include necessary settings
      const createCall = (vscode.window.createWebviewPanel as jest.Mock).mock.calls[0];
      const options = createCall[3];
      
      expect(options.enableScripts).toBe(true);
      expect(options.retainContextWhenHidden).toBe(true);
      expect(options.enableFindWidget).toBe(true);
      expect(options.enableCommandUris).toBe(true);
    });
  });

  describe('Asset Processing', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should process viewer.js asset when present in template', async () => {
      // Mock fs to return viewer template with script reference
      const fs = require('fs');
      fs.promises.readFile.mockResolvedValueOnce(
        '<html><script src="scripts/viewer.js"></script></html>'
      );

      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const mockWebview = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value.webview;
      
      // Should process viewer.js since it's referenced in the mocked template
      expect(mockWebview.asWebviewUri).toHaveBeenCalledWith(
        expect.objectContaining({
          fsPath: expect.stringContaining('scripts/viewer.js')
        })
      );
    });

    it('should not process editor assets in viewer template', async () => {
      // Mock fs to return viewer template without editor assets
      const fs = require('fs');
      fs.promises.readFile.mockResolvedValueOnce(
        '<html><script src="scripts/viewer.js"></script></html>'
      );

      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const mockWebview = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value.webview;
      
      // Should not process monaco-loader.js or editor.js for viewer template
      const calls = mockWebview.asWebviewUri.mock.calls;
      const monacoLoaderCalls = calls.filter(call => 
        call[0].fsPath.includes('monaco-loader.js')
      );
      const editorJsCalls = calls.filter(call => 
        call[0].fsPath.includes('editor.js')
      );
      
      expect(monacoLoaderCalls).toHaveLength(0);
      expect(editorJsCalls).toHaveLength(0);
    });
  });

  describe('Content Management', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should send initial content to webview', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const mockWebview = (vscode.window.createWebviewPanel as jest.Mock).mock.results[0].value.webview;
      
      // Should send content after a delay (setTimeout)
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: 'setContent',
        payload: { content: testMarkdownContent }
      });
    });

    it('should update webview content', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      const newContent = '# Updated Content';

      webviewProvider.updateWebviewContent(panelId, newContent);

      // Check that the content was updated in state
      const updatedPanels = webviewProvider.getActivePanels();
      expect(updatedPanels[0].state.content).toBe(newContent);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should handle webview ready message', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      // Should not throw error when handling webview ready
      expect(() => {
        webviewProvider.handleWebviewMessage({
          type: 'webviewReady' as any,
          payload: {}
        }, panelId);
      }).not.toThrow();
    });

    it('should handle execute command messages', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;

      // Should handle command execution without error
      expect(() => {
        webviewProvider.handleWebviewMessage({
          type: 'executeCommand' as any,
          payload: { command: 'refresh' }
        }, panelId);
      }).not.toThrow();
    });
  });

  describe('Viewer Mode Specific Features', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should create webview in viewer mode', async () => {
      const panel = await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      expect(panels[0].mode).toBe(EditorMode.VIEWER);
    });

    it('should load viewer template for viewer mode', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      // Verify that the template loading was attempted for viewer mode
      const fs = require('fs');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('viewer.html'),
        'utf8'
      );
    });

    it('should handle template loading errors gracefully', async () => {
      // Mock fs to throw an error
      const fs = require('fs');
      fs.promises.readFile.mockRejectedValueOnce(new Error('Template not found'));

      const panel = await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      // Should still create panel but with error content
      expect(panel).toBeDefined();
      expect(panel.webview.html).toContain('Failed to load viewer template');
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await webviewProvider.initialize();
    });

    it('should preserve viewer state', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      const state = webviewProvider.getWebviewState(panelId);
      
      expect(state).toBeDefined();
      expect(state?.mode).toBe(EditorMode.VIEWER);
      expect(state?.content).toBe(testMarkdownContent);
    });

    it('should restore viewer state', async () => {
      await webviewProvider.createViewerWebview(mockUri, testMarkdownContent);
      
      const panels = webviewProvider.getActivePanels();
      const panelId = panels[0].id;
      
      const newState = {
        documentId: 'test-doc',
        mode: EditorMode.VIEWER,
        content: '# Restored Content',
        isDirty: false,
        lastModified: new Date()
      };

      webviewProvider.restoreWebviewState(panelId, newState);
      
      const restoredState = webviewProvider.getWebviewState(panelId);
      expect(restoredState?.content).toBe('# Restored Content');
    });
  });
});

describe('Viewer Asset Files', () => {
  it('should have viewer.js file in the correct location', () => {
    const fs = require('fs');
    const path = require('path');
    
    const viewerJsPath = path.join(__dirname, '..', 'webview', 'scripts', 'viewer.js');
    expect(fs.existsSync(viewerJsPath)).toBe(true);
  });

  it('should have viewer.html template file', () => {
    const fs = require('fs');
    const path = require('path');
    
    const viewerHtmlPath = path.join(__dirname, '..', 'webview', 'templates', 'viewer.html');
    expect(fs.existsSync(viewerHtmlPath)).toBe(true);
  });
});