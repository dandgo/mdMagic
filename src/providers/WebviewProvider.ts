/**
 * WebviewProvider - Manages webview creation, lifecycle, and communication
 * Handles webview panel management, message passing, and state preservation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Component } from '../controllers/ExtensionController';
import {
  EditorMode,
  MessageType,
  WebviewMessage,
  WebviewState,
  WebviewPanelInfo,
  WebviewOptions,
} from '../types/webview';

export class WebviewProvider implements Component {
  public readonly id = 'webviewProvider';
  public readonly name = 'Webview Provider';

  private panels = new Map<string, WebviewPanelInfo>();
  private disposables: vscode.Disposable[] = [];
  private extensionPath: string;
  private messageHandlers = new Map<MessageType, Function>();
  private extensionController: any = null;

  constructor(private context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
    this.setupMessageHandlers();
  }

  /**
   * Set the extension controller reference
   */
  public setExtensionController(controller: any): void {
    this.extensionController = controller;
  }

  /**
   * Initialize the webview provider
   */
  public async initialize(): Promise<void> {
    console.log('[WebviewProvider] Initializing...');

    // Register webview serializer for state restoration
    const serializer = new WebviewSerializer(this);
    this.context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer('mdMagic.editor', serializer),
      vscode.window.registerWebviewPanelSerializer('mdMagic.viewer', serializer)
    );

    console.log('[WebviewProvider] Initialized successfully');
  }

  /**
   * Create a new webview for the specified document and mode
   */
  public async createWebview(
    documentUri: vscode.Uri,
    mode: EditorMode,
    content: string = ''
  ): Promise<vscode.WebviewPanel> {
    const documentId = this.generateDocumentId(documentUri);

    // Check if webview already exists for this document
    const existingPanel = this.getWebviewByDocumentId(documentId);
    if (existingPanel) {
      existingPanel.panel.reveal();
      return existingPanel.panel;
    }

    // Create new webview panel
    const panel = vscode.window.createWebviewPanel(
      mode === EditorMode.Editor ? 'mdMagic.editor' : 'mdMagic.viewer',
      `mdMagic ${mode}: ${path.basename(documentUri.fsPath)}`,
      vscode.ViewColumn.One,
      this.getWebviewOptions()
    );

    // Set up the webview
    await this.setupWebview(panel, documentUri, mode, content);

    return panel;
  }

  /**
   * Create editor webview
   */
  public async createEditorWebview(
    documentUri: vscode.Uri,
    content: string = ''
  ): Promise<vscode.WebviewPanel> {
    return this.createWebview(documentUri, EditorMode.Editor, content);
  }

  /**
   * Create viewer webview
   */
  public async createViewerWebview(
    documentUri: vscode.Uri,
    content: string = ''
  ): Promise<vscode.WebviewPanel> {
    return this.createWebview(documentUri, EditorMode.Viewer, content);
  }

  /**
   * Update webview content
   */
  public updateWebviewContent(panelId: string, content: string): void {
    const panelInfo = this.panels.get(panelId);
    if (!panelInfo) {
      console.warn(`[WebviewProvider] Panel ${panelId} not found`);
      return;
    }

    // Update state
    panelInfo.state.content = content;
    panelInfo.state.lastModified = new Date();

    // Send content to webview
    panelInfo.panel.webview.postMessage({
      type: MessageType.CONTENT_CHANGED,
      payload: { content },
    });
  }

  /**
   * Handle messages from webviews
   */
  public handleWebviewMessage(message: WebviewMessage, panelId: string): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message, panelId);
    } else {
      console.warn(`[WebviewProvider] No handler for message type: ${message.type}`);
    }
  }

  /**
   * Dispose a specific webview
   */
  public disposeWebview(panelId: string): void {
    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      panelInfo.panel.dispose();
      this.panels.delete(panelId);
      console.log(`[WebviewProvider] Disposed webview ${panelId}`);
    }
  }

  /**
   * Get all active webview panels
   */
  public getActivePanels(): WebviewPanelInfo[] {
    return Array.from(this.panels.values());
  }

  /**
   * Get webview by document ID
   */
  public getWebviewByDocumentId(documentId: string): WebviewPanelInfo | undefined {
    return Array.from(this.panels.values()).find((panel) => panel.documentId === documentId);
  }

  /**
   * Get webview state for persistence
   */
  public getWebviewState(panelId: string): WebviewState | undefined {
    const panelInfo = this.panels.get(panelId);
    return panelInfo?.state;
  }

  /**
   * Restore webview state
   */
  public restoreWebviewState(panelId: string, state: WebviewState): void {
    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      panelInfo.state = { ...panelInfo.state, ...state };

      // Send restored content to webview
      panelInfo.panel.webview.postMessage({
        type: MessageType.SET_CONTENT,
        payload: { content: state.content },
      });
    }
  }

  /**
   * Dispose the webview provider
   */
  public dispose(): void {
    console.log('[WebviewProvider] Disposing...');

    // Dispose all panels
    for (const [panelId, panelInfo] of this.panels) {
      try {
        // Clear any pending timeouts
        if (panelInfo.timeoutId) {
          clearTimeout(panelInfo.timeoutId);
        }
        panelInfo.panel.dispose();
      } catch (error) {
        console.error(`[WebviewProvider] Error disposing panel ${panelId}:`, error);
      }
    }
    this.panels.clear();

    // Dispose all registered disposables
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('[WebviewProvider] Error disposing resource:', error);
      }
    }
    this.disposables = [];

    console.log('[WebviewProvider] Disposed successfully');
  }

  /**
   * Set up webview panel with content and event handlers
   */
  private async setupWebview(
    panel: vscode.WebviewPanel,
    documentUri: vscode.Uri,
    mode: EditorMode,
    content: string
  ): Promise<void> {
    const panelId = this.generatePanelId();
    const documentId = this.generateDocumentId(documentUri);

    // Ensure document is opened in DocumentManager for file watching
    try {
      const documentManager = this.extensionController?.getComponent('document-manager');
      if (documentManager) {
        await documentManager.openDocument(documentUri);
        console.log(`[WebviewProvider] Opened document in DocumentManager: ${documentUri.fsPath}`);
      }
    } catch (error) {
      console.warn(`[WebviewProvider] Failed to open document in DocumentManager: ${error}`);
    }

    // Create panel info
    const panelInfo: WebviewPanelInfo = {
      id: panelId,
      title: panel.title,
      documentId,
      mode,
      panel,
      state: {
        documentId,
        mode,
        content,
        isDirty: false,
        lastModified: new Date(),
      },
      isActive: panel.active,
      isVisible: panel.visible,
    };

    // Set webview HTML content
    panel.webview.html = await this.getWebviewContent(mode, panel.webview);

    // Set up state serialization
    const getState = () => ({
      documentId,
      mode,
      content: panelInfo.state.content,
      isDirty: panelInfo.state.isDirty,
      lastModified: panelInfo.state.lastModified.toISOString(),
      documentUri: documentUri.toString(),
    });

    // Set the state getter for serialization
    (panel as any).getState = getState;

    // Set up message handling
    const messageDisposable = panel.webview.onDidReceiveMessage((message: WebviewMessage) =>
      this.handleWebviewMessage(message, panelId)
    );

    // Set up panel event handlers
    const disposeDisposable = panel.onDidDispose(() => {
      const panelInfo = this.panels.get(panelId);
      if (panelInfo?.timeoutId) {
        clearTimeout(panelInfo.timeoutId);
      }
      this.panels.delete(panelId);
      messageDisposable.dispose();
      disposeDisposable.dispose();
      changeDisposable.dispose();
    });

    const changeDisposable = panel.onDidChangeViewState(() => {
      if (this.panels.has(panelId)) {
        const info = this.panels.get(panelId)!;
        info.isActive = panel.active;
        info.isVisible = panel.visible;
      }
    });

    // Store panel info
    this.panels.set(panelId, panelInfo);

    // Register disposables
    this.disposables.push(messageDisposable, disposeDisposable, changeDisposable);

    // Send initial content once webview is ready
    const timeoutId = setTimeout(() => {
      console.log(
        `[WebviewProvider] Sending initial content to webview: ${content.substring(0, 100)}...`
      );
      panel.webview.postMessage({
        type: MessageType.SET_CONTENT,
        payload: { content },
      });
    }, 100);

    // Store timeout ID for cleanup
    panelInfo.timeoutId = timeoutId;

    console.log(
      `[WebviewProvider] Created ${mode} webview for ${path.basename(documentUri.fsPath)}`
    );
  }

  /**
   * Get webview options
   */
  private getWebviewOptions(): vscode.WebviewPanelOptions & vscode.WebviewOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.extensionPath, 'src', 'webview')),
        vscode.Uri.file(path.join(this.extensionPath, 'media')),
      ],
      enableFindWidget: true,
      enableCommandUris: true,
    };
  }

  /**
   * Get webview HTML content based on mode
   */
  private async getWebviewContent(mode: EditorMode, webview: vscode.Webview): Promise<string> {
    const templatePath = path.join(
      this.extensionPath,
      'src',
      'webview',
      'templates',
      `${mode}.html`
    );

    try {
      let htmlContent = await fs.promises.readFile(templatePath, 'utf8');

      // Replace asset references with webview URIs
      htmlContent = this.processAssetUrls(htmlContent, webview);

      return htmlContent;
    } catch (error) {
      console.error(`[WebviewProvider] Failed to load template for ${mode}:`, error);
      return this.getErrorContent(`Failed to load ${mode} template`);
    }
  }

  /**
   * Process asset URLs to use webview URIs
   */
  private processAssetUrls(html: string, webview: vscode.Webview): string {
    // Create URIs for assets
    const webviewPath = vscode.Uri.file(path.join(this.extensionPath, 'src', 'webview'));

    // Only process assets that actually exist in the HTML
    if (html.includes('href="styles/editor.css"')) {
      const stylesUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(webviewPath.fsPath, 'styles', 'editor.css'))
      );
      html = html.replace('href="styles/editor.css"', `href="${stylesUri}"`);
    }

    if (html.includes('src="scripts/monaco-loader.js"')) {
      const monacoLoaderUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(webviewPath.fsPath, 'scripts', 'monaco-loader.js'))
      );
      html = html.replace('src="scripts/monaco-loader.js"', `src="${monacoLoaderUri}"`);
    }

    if (html.includes('src="scripts/editor.js"')) {
      const editorJsUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(webviewPath.fsPath, 'scripts', 'editor.js'))
      );
      html = html.replace('src="scripts/editor.js"', `src="${editorJsUri}"`);
    }

    if (html.includes('src="scripts/viewer.js"')) {
      const viewerJsUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(webviewPath.fsPath, 'scripts', 'viewer.js'))
      );
      html = html.replace('src="scripts/viewer.js"', `src="${viewerJsUri}"`);
    }

    return html;
  }

  /**
   * Get error content HTML
   */
  private getErrorContent(message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error</title>
          <style>
              body { 
                  font-family: var(--vscode-font-family); 
                  color: var(--vscode-errorForeground);
                  background-color: var(--vscode-editor-background);
                  padding: 20px;
              }
          </style>
      </head>
      <body>
          <h1>Error</h1>
          <p>${message}</p>
      </body>
      </html>
    `;
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    this.messageHandlers.set(MessageType.WEBVIEW_READY, this.handleWebviewReady.bind(this));
    this.messageHandlers.set(MessageType.CONTENT_CHANGED, this.handleContentChanged.bind(this));
    this.messageHandlers.set(MessageType.SAVE_DOCUMENT, this.handleSaveDocument.bind(this));
    this.messageHandlers.set(MessageType.EXECUTE_COMMAND, this.handleExecuteCommand.bind(this));
  }

  /**
   * Handle webview ready message
   */
  private handleWebviewReady(message: WebviewMessage, panelId: string): void {
    console.log(`[WebviewProvider] Webview ${panelId} is ready`);

    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      const content = panelInfo.state.content;
      console.log(
        `[WebviewProvider] Sending content to ready webview: ${content.substring(0, 100)}...`
      );

      // Send initial content
      panelInfo.panel.webview.postMessage({
        type: MessageType.SET_CONTENT,
        payload: { content },
      });
    } else {
      console.warn(`[WebviewProvider] Panel ${panelId} not found when ready`);
    }
  }

  /**
   * Handle content changed message
   */
  private handleContentChanged(message: WebviewMessage, panelId: string): void {
    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      panelInfo.state.content = message.payload.content;
      panelInfo.state.isDirty = message.payload.isDirty || true;
      panelInfo.state.lastModified = new Date();
    }
  }

  /**
   * Handle save document message
   */
  private handleSaveDocument(message: WebviewMessage, panelId: string): void {
    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      // TODO: Implement actual document saving
      console.log(`[WebviewProvider] Save request for document ${panelInfo.documentId}`);
      panelInfo.state.isDirty = false;
    }
  }

  /**
   * Handle execute command message
   */
  private handleExecuteCommand(message: WebviewMessage, panelId: string): void {
    const { command, args } = message.payload;

    try {
      if (command === 'vscode.open') {
        vscode.env.openExternal(vscode.Uri.parse(args[0]));
      } else if (command === 'refresh') {
        // Handle refresh command with document URI from panel context
        const panelInfo = this.panels.get(panelId);
        if (panelInfo) {
          // Extract URI from document ID or get current active document
          const activeEditor = vscode.window.activeTextEditor;
          const uri = activeEditor?.document?.uri;
          
          if (uri && uri.path.endsWith('.md')) {
            vscode.commands.executeCommand('mdMagic.refresh', uri);
          } else {
            vscode.window.showWarningMessage('No markdown file available to refresh');
          }
        }
      } else {
        vscode.commands.executeCommand(command, ...(args || []));
      }
    } catch (error) {
      console.error(`[WebviewProvider] Failed to execute command ${command}:`, error);
    }
  }

  /**
   * Generate unique panel ID
   */
  private generatePanelId(): string {
    return `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate document ID from URI
   */
  private generateDocumentId(uri: vscode.Uri): string {
    return `doc_${Buffer.from(uri.toString()).toString('base64').replace(/[+/=]/g, '')}`;
  }
}

/**
 * Webview serializer for state restoration
 */
class WebviewSerializer implements vscode.WebviewPanelSerializer {
  constructor(private webviewProvider: WebviewProvider) {}

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
    console.log('[WebviewSerializer] Deserializing webview panel:', state);

    try {
      // Extract state information
      const { documentId, mode, content, isDirty, lastModified, documentUri } = state;

      if (!documentId || !mode || !documentUri) {
        console.warn('[WebviewSerializer] Invalid state data, cannot restore webview');
        webviewPanel.dispose();
        return;
      }

      // Recreate the URI from the state
      const uri = vscode.Uri.parse(documentUri);

      // Generate a new panel ID for the restored webview
      const panelId = this.webviewProvider['generatePanelId']();

      // Create restored webview state
      const restoredState: WebviewState = {
        documentId,
        mode: mode as EditorMode,
        content: content || '',
        isDirty: isDirty || false,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
      };

      // Create panel info for the restored webview
      const panelInfo: WebviewPanelInfo = {
        id: panelId,
        title: webviewPanel.title,
        documentId,
        mode: mode as EditorMode,
        panel: webviewPanel,
        state: restoredState,
        isActive: webviewPanel.active,
        isVisible: webviewPanel.visible,
      };

      // Set webview options
      webviewPanel.webview.options = this.webviewProvider['getWebviewOptions']();

      // Load webview content based on mode
      webviewPanel.webview.html = await this.webviewProvider['getWebviewContent'](
        mode as EditorMode,
        webviewPanel.webview
      );

      // Set up message handling for the restored webview
      const messageDisposable = webviewPanel.webview.onDidReceiveMessage(
        (message: WebviewMessage) => this.webviewProvider.handleWebviewMessage(message, panelId)
      );

      // Set up panel event handlers
      const disposeDisposable = webviewPanel.onDidDispose(() => {
        this.webviewProvider['panels'].delete(panelId);
        messageDisposable.dispose();
        disposeDisposable.dispose();
        changeDisposable.dispose();
      });

      const changeDisposable = webviewPanel.onDidChangeViewState(() => {
        if (this.webviewProvider['panels'].has(panelId)) {
          const info = this.webviewProvider['panels'].get(panelId)!;
          info.isActive = webviewPanel.active;
          info.isVisible = webviewPanel.visible;
        }
      });

      // Store the restored panel info
      this.webviewProvider['panels'].set(panelId, panelInfo);

      // Register disposables
      this.webviewProvider['disposables'].push(
        messageDisposable,
        disposeDisposable,
        changeDisposable
      );

      // Send restored content to webview once it's ready
      setTimeout(() => {
        webviewPanel.webview.postMessage({
          type: MessageType.SET_CONTENT,
          payload: { content: restoredState.content },
        });
      }, 100);

      console.log(
        `[WebviewSerializer] Successfully restored ${mode} webview for document ${documentId}`
      );
    } catch (error) {
      console.error('[WebviewSerializer] Error restoring webview panel:', error);

      // Provide fallback content if restoration fails
      webviewPanel.webview.html = this.webviewProvider['getErrorContent'](
        'Failed to restore webview. Please reopen the document.'
      );
    }
  }
}
