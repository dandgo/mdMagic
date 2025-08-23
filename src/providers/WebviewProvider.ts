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

  constructor(private context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
    this.setupMessageHandlers();
  }

  /**
   * Initialize the webview provider
   */
  public async initialize(): Promise<void> {
    console.log('[WebviewProvider] Initializing...');

    // Register webview serializer for state restoration
    const serializer = new WebviewSerializer();
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
      mode === EditorMode.EDITOR ? 'mdMagic.editor' : 'mdMagic.viewer',
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
    return this.createWebview(documentUri, EditorMode.EDITOR, content);
  }

  /**
   * Create viewer webview
   */
  public async createViewerWebview(
    documentUri: vscode.Uri,
    content: string = ''
  ): Promise<vscode.WebviewPanel> {
    return this.createWebview(documentUri, EditorMode.VIEWER, content);
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
        type: 'setContent',
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
    panel.webview.html = await this.getWebviewContent(mode);

    // Set up message handling
    const messageDisposable = panel.webview.onDidReceiveMessage((message: WebviewMessage) =>
      this.handleWebviewMessage(message, panelId)
    );

    // Set up panel event handlers
    const disposeDisposable = panel.onDidDispose(() => {
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
    setTimeout(() => {
      panel.webview.postMessage({
        type: 'setContent',
        payload: { content },
      });
    }, 100);

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
  private async getWebviewContent(mode: EditorMode): Promise<string> {
    const templatePath = path.join(
      this.extensionPath,
      'src',
      'webview',
      'templates',
      `${mode}.html`
    );

    try {
      const htmlContent = await fs.promises.readFile(templatePath, 'utf8');
      return htmlContent;
    } catch (error) {
      console.error(`[WebviewProvider] Failed to load template for ${mode}:`, error);
      return this.getErrorContent(`Failed to load ${mode} template`);
    }
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
    if (panelInfo && panelInfo.state.content) {
      // Send initial content
      panelInfo.panel.webview.postMessage({
        type: 'setContent',
        payload: { content: panelInfo.state.content },
      });
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
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
    console.log('[WebviewSerializer] Deserializing webview panel:', state);

    // TODO: Restore webview state from serialized data
    // This will be called when VS Code restarts and needs to restore webviews

    webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Restoring...</title>
      </head>
      <body>
          <p>Restoring webview...</p>
      </body>
      </html>
    `;
  }
}
