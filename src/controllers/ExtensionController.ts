/**
 * Extension Controller - Main entry point and orchestration
 * Manages extension lifecycle, component initialization, and global state
 */

import * as vscode from 'vscode';

export interface Component {
  id: string;
  name: string;
  initialize(): Promise<void>;
  dispose(): void;
}

export class ExtensionController {
  private static instance: ExtensionController | undefined;
  private components: Map<string, Component> = new Map();
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  constructor(private context: vscode.ExtensionContext) {
    ExtensionController.instance = this;
  }

  /**
   * Get the singleton instance of ExtensionController
   */
  public static getInstance(): ExtensionController | undefined {
    return ExtensionController.instance;
  }

  /**
   * Initialize the extension controller and all components
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logInfo('Extension controller already initialized');
      return;
    }

    try {
      this.logInfo('Initializing mdMagic extension controller...');

      await this.registerComponents();
      this.setupEventListeners();

      this.isInitialized = true;
      this.logInfo('mdMagic extension controller initialized successfully');
    } catch (error) {
      this.handleError(error, 'Failed to initialize extension controller');
      throw error;
    }
  }

  /**
   * Register extension components
   * This is a placeholder for future components (DocumentManager, ConfigManager, etc.)
   */
  private async registerComponents(): Promise<void> {
    this.logInfo('Registering components...');

    // Register ConfigManager first (other components may depend on configuration)
    const { ConfigManager } = require('../managers/ConfigManager');
    const configManager = new ConfigManager(this.context);
    await this.registerComponent(configManager);

    // Register DocumentManager
    const { DocumentManager } = require('../managers/DocumentManager');
    const documentManager = new DocumentManager(this.context);
    await this.registerComponent(documentManager);

    // Register ModeManager (depends on ConfigManager and DocumentManager)
    const { ModeManager } = require('../managers/ModeManager');
    const modeManager = new ModeManager(this.context, documentManager, configManager);
    await this.registerComponent(modeManager);

    // Register CommandManager (depends on other managers for command execution)
    const { CommandManager } = require('../managers/CommandManager');
    const commandManager = new CommandManager(this.context);
    await this.registerComponent(commandManager);

    // Register WebviewProvider
    const { WebviewProvider } = require('../providers/WebviewProvider');
    const webviewProvider = new WebviewProvider(this.context);
    webviewProvider.setExtensionController(this);
    await this.registerComponent(webviewProvider);

    // Register StatusBarManager
    const { StatusBarManager } = require('../managers/StatusBarManager');
    const statusBarManager = new StatusBarManager(this.context);
    await this.registerComponent(statusBarManager);

    // Set up component connections
    this.setupComponentConnections();

    this.logInfo('Component registration complete');
  }

  /**
   * Register a component with the extension controller
   */
  public async registerComponent(component: Component): Promise<void> {
    try {
      if (this.components.has(component.id)) {
        this.logWarning(`Component ${component.id} is already registered`);
        return;
      }

      await component.initialize();
      this.components.set(component.id, component);
      this.logInfo(`Component ${component.name} (${component.id}) registered successfully`);
    } catch (error) {
      this.handleError(error, `Failed to register component ${component.name}`);
      throw error;
    }
  }

  /**
   * Set up connections between components
   */
  private setupComponentConnections(): void {
    this.logInfo('Setting up component connections...');

    const documentManager = this.getComponent('document-manager') as any;
    const webviewProvider = this.getComponent('webviewProvider') as any;

    if (documentManager && webviewProvider) {
      // Connect document changes to webview updates
      const documentChangeDisposable = documentManager.addChangeListener((event: any) => {
        this.logInfo(`Document change event: ${event.type} for ${event.document.uri.fsPath}`);
        
        if (event.type === 'external' || event.type === 'content') {
          // Find webview for this document and update it
          const documentId = `doc_${Buffer.from(event.document.uri.toString()).toString('base64').replace(/[+/=]/g, '')}`;
          const panelInfo = webviewProvider.getWebviewByDocumentId(documentId);
          
          if (panelInfo) {
            this.logInfo(`Updating webview content for ${event.document.uri.fsPath}`);
            
            panelInfo.panel.webview.postMessage({
              type: 'setContent',
              payload: { content: event.document.content }
            });
          }
        }
      });

      this.disposables.push(documentChangeDisposable);
      this.context.subscriptions.push(documentChangeDisposable);
    }

    this.logInfo('Component connections setup complete');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.logInfo('Setting up event listeners...');

    // Listen for configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mdMagic')) {
        this.logInfo('mdMagic configuration changed');
        // TODO: Handle configuration changes
      }
    });

    this.disposables.push(configDisposable);
    this.context.subscriptions.push(configDisposable);

    this.logInfo('Event listeners setup complete');
  }

  /**
   * Get the VS Code extension context
   */
  public getContext(): vscode.ExtensionContext {
    return this.context;
  }

  /**
   * Get all registered components
   */
  public getComponents(): Map<string, Component> {
    return new Map(this.components);
  }

  /**
   * Get a specific component by ID
   */
  public getComponent<T extends Component>(id: string): T | undefined {
    return this.components.get(id) as T | undefined;
  }

  /**
   * Check if the controller is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Dispose of the extension controller and all components
   */
  public dispose(): void {
    try {
      this.logInfo('Disposing mdMagic extension controller...');

      // Dispose all components
      for (const [id, component] of this.components) {
        try {
          component.dispose();
          this.logInfo(`Component ${component.name} (${id}) disposed`);
        } catch (error) {
          this.handleError(error, `Failed to dispose component ${component.name}`);
        }
      }
      this.components.clear();

      // Dispose all registered disposables
      for (const disposable of this.disposables) {
        try {
          disposable.dispose();
        } catch (error) {
          this.handleError(error, 'Failed to dispose resource');
        }
      }
      this.disposables = [];

      this.isInitialized = false;
      ExtensionController.instance = undefined;

      this.logInfo('mdMagic extension controller disposed successfully');
    } catch (error) {
      this.handleError(error, 'Failed to dispose extension controller');
    }
  }

  /**
   * Handle errors with consistent logging
   */
  private handleError(error: unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

    console.error(`[mdMagic Error] ${fullMessage}`);

    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic Error Stack] ${error.stack}`);
    }

    // Show error to user for critical failures
    if (context?.includes('Failed to initialize')) {
      vscode.window.showErrorMessage(`mdMagic: ${fullMessage}`);
    }
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic] ${message}`);
  }

  /**
   * Log warning messages
   */
  private logWarning(message: string): void {
    console.warn(`[mdMagic Warning] ${message}`);
  }
}
