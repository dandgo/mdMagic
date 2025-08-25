/**
 * CommandManager - Manages command registration, execution, and validation
 * Provides command palette integration, keyboard shortcuts, and context menu support
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';
import { EditorMode } from '../managers/MarkdownDocument';

// Command interfaces
export interface CommandHandler {
  execute(args?: any[]): Promise<any>;
  canExecute?(args?: any[]): boolean;
}

export interface CommandDefinition {
  id: string;
  title: string;
  category: string;
  handler: CommandHandler;
  when?: string; // VS Code when clause for conditional availability
}

export interface ICommandManager extends Component {
  registerCommand(command: CommandDefinition): vscode.Disposable;
  executeCommand(commandId: string, args?: any[]): Promise<any>;
  getAvailableCommands(): string[];
  isCommandAvailable(commandId: string): boolean;
}

export class CommandManager implements ICommandManager {
  public readonly id = 'commandManager';
  public readonly name = 'Command Manager';

  private commands = new Map<string, CommandDefinition>();
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Initialize the command manager and register all commands
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logInfo('Initializing Command Manager...');

      // Register core commands
      await this.registerCoreCommands();

      this.isInitialized = true;
      this.logInfo('Command Manager initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Command Manager', error);
      throw error;
    }
  }

  /**
   * Register all core extension commands
   */
  private async registerCoreCommands(): Promise<void> {
    // Import managers that commands will interact with
    const ExtensionController = require('../controllers/ExtensionController').ExtensionController;
    const controller = ExtensionController.getInstance();

    // Toggle Mode Command
    this.registerCommand({
      id: 'mdMagic.toggleMode',
      title: 'Toggle Mode',
      category: 'mdMagic',
      handler: {
        execute: async () => {
          const modeManager = controller?.getComponent('modeManager');
          const activeEditor = vscode.window.activeTextEditor;

          if (!activeEditor || !activeEditor.document.fileName.endsWith('.md')) {
            vscode.window.showErrorMessage('Please open a markdown file first');
            return;
          }

          if (modeManager) {
            const documentId = activeEditor.document.uri.toString();
            const currentMode = modeManager.getCurrentMode(documentId);
            const targetMode =
              currentMode === EditorMode.Editor ? EditorMode.Viewer : EditorMode.Editor;
            await modeManager.switchMode(documentId, targetMode);
          }
        },
        canExecute: () => {
          const activeEditor = vscode.window.activeTextEditor;
          return activeEditor?.document.fileName.endsWith('.md') ?? false;
        },
      },
    });

    // Switch to Editor Command
    this.registerCommand({
      id: 'mdMagic.switchToEditor',
      title: 'Switch to Editor Mode',
      category: 'mdMagic',
      handler: {
        execute: async (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          if (!uri) {
            vscode.window.showErrorMessage('No markdown file selected');
            return;
          }

          const webviewProvider = controller?.getComponent('webviewProvider');
          if (webviewProvider) {
            const document = await vscode.workspace.openTextDocument(uri);
            await webviewProvider.createEditorWebview(uri, document.getText());
          }
        },
        canExecute: (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          return uri?.path.endsWith('.md') ?? false;
        },
      },
    });

    // Switch to Viewer Command
    this.registerCommand({
      id: 'mdMagic.switchToViewer',
      title: 'Switch to Viewer Mode',
      category: 'mdMagic',
      handler: {
        execute: async (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          if (!uri) {
            vscode.window.showErrorMessage('No markdown file selected');
            return;
          }

          const webviewProvider = controller?.getComponent('webviewProvider');
          if (webviewProvider) {
            const document = await vscode.workspace.openTextDocument(uri);
            await webviewProvider.createViewerWebview(uri, document.getText());
          }
        },
        canExecute: (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          return uri?.path.endsWith('.md') ?? false;
        },
      },
    });

    // Format Bold Command
    this.registerCommand({
      id: 'mdMagic.formatBold',
      title: 'Format Bold',
      category: 'mdMagic',
      handler: {
        execute: async () => {
          await this.insertTextFormatting('**', '**');
        },
        canExecute: () => {
          const activeEditor = vscode.window.activeTextEditor;
          return activeEditor?.document.fileName.endsWith('.md') ?? false;
        },
      },
    });

    // Format Italic Command
    this.registerCommand({
      id: 'mdMagic.formatItalic',
      title: 'Format Italic',
      category: 'mdMagic',
      handler: {
        execute: async () => {
          await this.insertTextFormatting('*', '*');
        },
        canExecute: () => {
          const activeEditor = vscode.window.activeTextEditor;
          return activeEditor?.document.fileName.endsWith('.md') ?? false;
        },
      },
    });

    // Insert Link Command
    this.registerCommand({
      id: 'mdMagic.insertLink',
      title: 'Insert Link',
      category: 'mdMagic',
      handler: {
        execute: async () => {
          const linkText = await vscode.window.showInputBox({
            prompt: 'Enter link text',
            placeHolder: 'Link text',
          });

          if (!linkText) {
            return;
          }

          const linkUrl = await vscode.window.showInputBox({
            prompt: 'Enter link URL',
            placeHolder: 'https://example.com',
          });

          if (!linkUrl) {
            return;
          }

          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor) {
            await activeEditor.edit((editBuilder) => {
              const selection = activeEditor.selection;
              editBuilder.replace(selection, `[${linkText}](${linkUrl})`);
            });
          }
        },
        canExecute: () => {
          const activeEditor = vscode.window.activeTextEditor;
          return activeEditor?.document.fileName.endsWith('.md') ?? false;
        },
      },
    });

    // Keep existing commands for backward compatibility
    this.registerCommand({
      id: 'mdMagic.openEditor',
      title: 'Open in Editor Mode',
      category: 'mdMagic',
      handler: {
        execute: async (args?: any[]) => {
          return this.executeCommand('mdMagic.switchToEditor', args);
        },
      },
    });

    this.registerCommand({
      id: 'mdMagic.openViewer',
      title: 'Open in Viewer Mode',
      category: 'mdMagic',
      handler: {
        execute: async (args?: any[]) => {
          return this.executeCommand('mdMagic.switchToViewer', args);
        },
      },
    });

    // Refresh Command
    this.registerCommand({
      id: 'mdMagic.refresh',
      title: 'Refresh',
      category: 'mdMagic',
      handler: {
        execute: async (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          if (!uri) {
            vscode.window.showErrorMessage('No markdown file selected');
            return;
          }

          const documentManager = controller?.getComponent('document-manager');
          const webviewProvider = controller?.getComponent('webviewProvider');
          
          if (documentManager && webviewProvider) {
            try {
              // Refresh document from disk
              await documentManager.refreshDocument(uri);
              
              // Get updated content
              const document = await vscode.workspace.openTextDocument(uri);
              const content = document.getText();
              
              // Find active webview for this document
              const documentId = `doc_${Buffer.from(uri.toString()).toString('base64').replace(/[+/=]/g, '')}`;
              const panelInfo = webviewProvider.getWebviewByDocumentId(documentId);
              
              if (panelInfo) {
                // Update webview content
                panelInfo.panel.webview.postMessage({
                  type: 'setContent',
                  payload: { content }
                });
                
                vscode.window.showInformationMessage('Document refreshed');
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        },
        canExecute: (args?: any[]) => {
          const uri = args?.[0] || vscode.window.activeTextEditor?.document?.uri;
          return uri?.path.endsWith('.md') ?? false;
        },
      },
    });

    this.logInfo(`Registered ${this.commands.size} commands`);
  }

  /**
   * Register a command with VS Code
   */
  public registerCommand(command: CommandDefinition): vscode.Disposable {
    try {
      if (this.commands.has(command.id)) {
        this.logWarning(`Command ${command.id} is already registered`);
        return { dispose: () => {} };
      }

      // Register with VS Code
      const disposable = vscode.commands.registerCommand(command.id, async (...args: any[]) => {
        try {
          // Validate command can execute
          if (command.handler.canExecute && !command.handler.canExecute(args)) {
            this.logWarning(`Command ${command.id} cannot execute in current context`);
            return;
          }

          // Execute command
          return await command.handler.execute(args);
        } catch (error) {
          this.logError(`Failed to execute command ${command.id}`, error);
          vscode.window.showErrorMessage(
            `Failed to execute ${command.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      });

      // Store command definition and disposable
      this.commands.set(command.id, command);
      this.disposables.push(disposable);
      this.context.subscriptions.push(disposable);

      this.logInfo(`Command ${command.id} registered successfully`);
      return disposable;
    } catch (error) {
      this.logError(`Failed to register command ${command.id}`, error);
      throw error;
    }
  }

  /**
   * Execute a command by ID
   */
  public async executeCommand(commandId: string, args?: any[]): Promise<any> {
    try {
      const command = this.commands.get(commandId);
      if (!command) {
        throw new Error(`Command ${commandId} not found`);
      }

      if (command.handler.canExecute && !command.handler.canExecute(args)) {
        throw new Error(`Command ${commandId} cannot execute in current context`);
      }

      return await command.handler.execute(args);
    } catch (error) {
      this.logError(`Failed to execute command ${commandId}`, error);
      throw error;
    }
  }

  /**
   * Get list of available command IDs
   */
  public getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Check if a command is available
   */
  public isCommandAvailable(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Helper method to insert text formatting around selection
   */
  private async insertTextFormatting(before: string, after: string): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    await activeEditor.edit((editBuilder) => {
      const selection = activeEditor.selection;
      const selectedText = activeEditor.document.getText(selection);

      if (selectedText) {
        // Wrap selected text
        editBuilder.replace(selection, `${before}${selectedText}${after}`);
      } else {
        // Insert formatting at cursor with placeholder
        editBuilder.insert(selection.start, `${before}text${after}`);
        // Select the placeholder text
        const newSelection = new vscode.Selection(
          selection.start.translate(0, before.length),
          selection.start.translate(0, before.length + 4) // 'text'.length
        );
        activeEditor.selection = newSelection;
      }
    });
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.logInfo('Disposing Command Manager...');

    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.commands.clear();
    this.isInitialized = false;

    this.logInfo('Command Manager disposed');
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic CommandManager] ${message}`);
  }

  /**
   * Log warning messages
   */
  private logWarning(message: string): void {
    console.warn(`[mdMagic CommandManager Warning] ${message}`);
  }

  /**
   * Log error messages
   */
  private logError(message: string, error?: unknown): void {
    console.error(`[mdMagic CommandManager Error] ${message}`);

    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic CommandManager Error Stack] ${error.stack}`);
    }
  }
}
