/**
 * Status Bar Manager - VS Code status bar integration
 * Shows current mode, word count, and document statistics in VS Code status bar
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';
import { IDocumentManager } from './DocumentManager';
import { IModeManager } from './ModeManager';
import { IMarkdownDocument } from './MarkdownDocument';

export interface DocumentStats {
  words: number;
  characters: number;
  charactersWithSpaces: number;
  lines: number;
  paragraphs: number;
}

export class StatusBarManager implements Component {
  public readonly id = 'status-bar-manager';
  public readonly name = 'Status Bar Manager';

  private modeStatusBarItem: vscode.StatusBarItem;
  private statsStatusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];
  private documentManager: IDocumentManager | undefined;
  private modeManager: IModeManager | undefined;
  private currentDocument: IMarkdownDocument | undefined;

  constructor(private context: vscode.ExtensionContext) {
    // Create status bar items
    this.modeStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    
    this.statsStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
  }

  /**
   * Initialize the status bar manager
   */
  public async initialize(): Promise<void> {
    this.logInfo('Initializing Status Bar Manager...');

    try {
      // Get references to other managers
      const controller = await this.getExtensionController();
      this.documentManager = controller.getComponent('document-manager') as IDocumentManager;
      this.modeManager = controller.getComponent('mode-manager') as IModeManager;

      if (!this.documentManager || !this.modeManager) {
        throw new Error('Required managers not found');
      }

      this.setupStatusBarItems();
      this.setupEventListeners();
      this.registerCommands();

      // Show status bar items
      this.modeStatusBarItem.show();
      this.statsStatusBarItem.show();

      // Update with current state
      this.updateStatusBar();

      this.logInfo('Status Bar Manager initialized successfully');
    } catch (error) {
      this.handleError(error, 'Failed to initialize Status Bar Manager');
      throw error;
    }
  }

  /**
   * Set up status bar items
   */
  private setupStatusBarItems(): void {
    // Mode status bar item
    this.modeStatusBarItem.command = 'mdMagic.toggleMode';
    this.modeStatusBarItem.tooltip = 'Click to toggle between Editor and Viewer modes';

    // Stats status bar item
    this.statsStatusBarItem.command = 'mdMagic.showDocumentStats';
    this.statsStatusBarItem.tooltip = 'Document statistics - Click for details';
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.documentManager || !this.modeManager) {
      return;
    }

    // Listen for active document changes
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === 'markdown') {
        this.currentDocument = this.documentManager?.getDocument(editor.document.uri);
        this.updateStatusBar();
      } else {
        this.currentDocument = undefined;
        this.hideStatusBar();
      }
    });

    // Listen for document content changes
    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === 'markdown' && 
          this.currentDocument && 
          event.document.uri.toString() === this.currentDocument.uri.toString()) {
        // Debounce updates to avoid excessive calculations
        this.debounceUpdateStatusBar();
      }
    });

    // Listen for mode changes
    const modeChangeDisposable = this.modeManager.registerModeChangeListener((event) => {
      if (this.currentDocument && event.documentId === this.currentDocument.id) {
        this.updateModeIndicator(event.currentMode);
      }
    });

    this.disposables.push(
      activeEditorDisposable,
      documentChangeDisposable,
      modeChangeDisposable
    );

    this.context.subscriptions.push(...this.disposables);
  }

  /**
   * Register commands for status bar actions
   */
  private registerCommands(): void {
    const showStatsCommand = vscode.commands.registerCommand(
      'mdMagic.showDocumentStats',
      () => this.showDocumentStatsDialog()
    );

    this.disposables.push(showStatsCommand);
    this.context.subscriptions.push(showStatsCommand);
  }

  /**
   * Update the status bar with current document state
   */
  private updateStatusBar(): void {
    if (!this.currentDocument) {
      this.hideStatusBar();
      return;
    }

    this.updateModeIndicator();
    this.updateStatsIndicator();
  }

  /**
   * Update mode indicator
   */
  private updateModeIndicator(mode?: string): void {
    if (!this.currentDocument || !this.modeManager) {
      return;
    }

    const currentMode = mode || this.modeManager.getCurrentMode(this.currentDocument.id) || 'viewer';
    const modeDisplayName = currentMode === 'editor' ? 'Editor' : 'Viewer';
    
    this.modeStatusBarItem.text = `$(book) ${modeDisplayName}`;
    this.modeStatusBarItem.tooltip = `Current mode: ${modeDisplayName} - Click to toggle`;
  }

  /**
   * Update stats indicator
   */
  private updateStatsIndicator(): void {
    if (!this.currentDocument) {
      return;
    }

    const stats = this.calculateDocumentStats(this.currentDocument.content);
    
    this.statsStatusBarItem.text = `$(pencil) ${stats.words} words, ${stats.characters} chars`;
    this.statsStatusBarItem.tooltip = `Lines: ${stats.lines} | Words: ${stats.words} | Characters: ${stats.characters} | Paragraphs: ${stats.paragraphs}`;
  }

  /**
   * Calculate document statistics
   */
  private calculateDocumentStats(content: string): DocumentStats {
    if (!content.trim()) {
      return {
        words: 0,
        characters: 0,
        charactersWithSpaces: 0,
        lines: 0,
        paragraphs: 0
      };
    }

    const lines = content.split('\n').length;
    const characters = content.replace(/\s/g, '').length;
    const charactersWithSpaces = content.length;
    
    // Count words (split by whitespace, filter empty strings)
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    
    // Count paragraphs (separated by double newlines or more)
    const paragraphs = content.trim() ? content.split(/\n\s*\n/).filter(p => p.trim()).length : 0;

    return {
      words,
      characters,
      charactersWithSpaces,
      lines,
      paragraphs
    };
  }

  /**
   * Show detailed document statistics dialog
   */
  private async showDocumentStatsDialog(): Promise<void> {
    if (!this.currentDocument) {
      vscode.window.showInformationMessage('No markdown document is currently active');
      return;
    }

    const stats = this.calculateDocumentStats(this.currentDocument.content);
    const documentName = this.currentDocument.uri.fsPath.split(/[/\\]/).pop() || 'Document';

    const message = `Document Statistics for "${documentName}":

📄 Lines: ${stats.lines}
📝 Words: ${stats.words}  
🔤 Characters: ${stats.characters}
📃 Characters (with spaces): ${stats.charactersWithSpaces}
📋 Paragraphs: ${stats.paragraphs}`;

    const action = await vscode.window.showInformationMessage(
      message,
      'Copy to Clipboard',
      'Close'
    );

    if (action === 'Copy to Clipboard') {
      await vscode.env.clipboard.writeText(message);
      vscode.window.showInformationMessage('Statistics copied to clipboard');
    }
  }

  /**
   * Hide status bar items
   */
  private hideStatusBar(): void {
    this.modeStatusBarItem.hide();
    this.statsStatusBarItem.hide();
  }

  /**
   * Debounced status bar update
   */
  private debounceUpdateStatusBar = this.debounce(() => {
    this.updateStatsIndicator();
  }, 300);

  /**
   * Debounce utility
   */
  private debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  /**
   * Get extension controller instance
   */
  private async getExtensionController(): Promise<any> {
    const { ExtensionController } = require('../controllers/ExtensionController');
    const controller = ExtensionController.getInstance();
    
    if (!controller) {
      throw new Error('Extension controller not found');
    }
    
    return controller;
  }

  /**
   * Dispose of the status bar manager
   */
  public dispose(): void {
    this.logInfo('Disposing Status Bar Manager...');

    try {
      // Dispose status bar items
      if (this.modeStatusBarItem) {
        this.modeStatusBarItem.dispose();
      }
      if (this.statsStatusBarItem) {
        this.statsStatusBarItem.dispose();
      }

      // Dispose event listeners
      for (const disposable of this.disposables) {
        if (disposable && typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
      }
      this.disposables = [];

      this.logInfo('Status Bar Manager disposed successfully');
    } catch (error) {
      this.handleError(error, 'Failed to dispose Status Bar Manager');
    }
  }

  /**
   * Handle errors with consistent logging
   */
  private handleError(error: unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;

    console.error(`[mdMagic StatusBarManager Error] ${fullMessage}`);

    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic StatusBarManager Error Stack] ${error.stack}`);
    }
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic StatusBarManager] ${message}`);
  }
}