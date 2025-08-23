/**
 * DocumentManager - Manages markdown document operations, file watching, and state persistence
 * Handles multiple documents, file changes, and document lifecycle
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';
import { MarkdownDocument, IMarkdownDocument, EditorMode } from './MarkdownDocument';

export interface DocumentChangeEvent {
  document: IMarkdownDocument;
  type: 'content' | 'state' | 'external';
  timestamp: Date;
}

export type DocumentChangeListener = (event: DocumentChangeEvent) => void;

export interface IDocumentManager extends Component {
  openDocument(uri: vscode.Uri): Promise<IMarkdownDocument>;
  closeDocument(uri: vscode.Uri): Promise<void>;
  saveDocument(uri: vscode.Uri): Promise<void>;
  saveAllDocuments(): Promise<void>;
  getDocument(uri: vscode.Uri): IMarkdownDocument | undefined;
  getAllDocuments(): IMarkdownDocument[];
  hasDocument(uri: vscode.Uri): boolean;
  addChangeListener(listener: DocumentChangeListener): vscode.Disposable;
  refreshDocument(uri: vscode.Uri): Promise<void>;
}

export class DocumentManager implements IDocumentManager {
  public readonly id = 'document-manager';
  public readonly name = 'Document Manager';

  private documents = new Map<string, MarkdownDocument>();
  private watchers = new Map<string, vscode.FileSystemWatcher>();
  private changeListeners: DocumentChangeListener[] = [];
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Initialize the document manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logInfo('Initializing Document Manager...');
      
      // Set up document change listeners for VS Code workspace
      const textDocumentChangeDisposable = vscode.workspace.onDidChangeTextDocument(
        this.handleTextDocumentChange.bind(this)
      );
      this.disposables.push(textDocumentChangeDisposable);

      // Listen for document saves
      const saveDisposable = vscode.workspace.onDidSaveTextDocument(
        this.handleDocumentSave.bind(this)
      );
      this.disposables.push(saveDisposable);

      // Listen for document closes
      const closeDisposable = vscode.workspace.onDidCloseTextDocument(
        this.handleDocumentClose.bind(this)
      );
      this.disposables.push(closeDisposable);

      this.isInitialized = true;
      this.logInfo('Document Manager initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Document Manager', error);
      throw error;
    }
  }

  /**
   * Open a markdown document
   */
  public async openDocument(uri: vscode.Uri): Promise<IMarkdownDocument> {
    try {
      this.logInfo(`Opening document: ${uri.fsPath}`);

      // Check if document is already open
      const existingDocument = this.getDocument(uri);
      if (existingDocument) {
        this.logInfo(`Document already open: ${uri.fsPath}`);
        return existingDocument;
      }

      // Read file content
      const content = await this.readFileContent(uri);
      
      // Create document instance
      const document = new MarkdownDocument(uri, content);
      
      // Store document
      this.documents.set(uri.toString(), document);
      
      // Set up file watching
      this.watchDocument(document);
      
      // Notify listeners
      this.notifyChangeListeners({
        document,
        type: 'content',
        timestamp: new Date()
      });

      this.logInfo(`Document opened successfully: ${uri.fsPath}`);
      return document;
    } catch (error) {
      this.logError(`Failed to open document: ${uri.fsPath}`, error);
      throw error;
    }
  }

  /**
   * Close a document
   */
  public async closeDocument(uri: vscode.Uri): Promise<void> {
    try {
      this.logInfo(`Closing document: ${uri.fsPath}`);

      const uriString = uri.toString();
      const document = this.documents.get(uriString);
      
      if (!document) {
        this.logWarning(`Document not found for closing: ${uri.fsPath}`);
        return;
      }

      // Dispose file watcher
      const watcher = this.watchers.get(document.id);
      if (watcher) {
        watcher.dispose();
        this.watchers.delete(document.id);
      }

      // Remove document
      this.documents.delete(uriString);

      this.logInfo(`Document closed successfully: ${uri.fsPath}`);
    } catch (error) {
      this.logError(`Failed to close document: ${uri.fsPath}`, error);
      throw error;
    }
  }

  /**
   * Save a document
   */
  public async saveDocument(uri: vscode.Uri): Promise<void> {
    try {
      this.logInfo(`Saving document: ${uri.fsPath}`);

      const document = this.getDocument(uri);
      if (!document) {
        throw new Error(`Document not found: ${uri.fsPath}`);
      }

      if (!document.isDirty) {
        this.logInfo(`Document is not dirty, skipping save: ${uri.fsPath}`);
        return;
      }

      // Write content to file
      const content = Buffer.from(document.content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, content);

      // Mark document as clean
      document.markClean();

      // Notify listeners
      this.notifyChangeListeners({
        document,
        type: 'state',
        timestamp: new Date()
      });

      this.logInfo(`Document saved successfully: ${uri.fsPath}`);
    } catch (error) {
      this.logError(`Failed to save document: ${uri.fsPath}`, error);
      throw error;
    }
  }

  /**
   * Save all dirty documents
   */
  public async saveAllDocuments(): Promise<void> {
    try {
      this.logInfo('Saving all dirty documents...');

      const savePromises: Promise<void>[] = [];
      
      for (const document of this.documents.values()) {
        if (document.isDirty) {
          savePromises.push(this.saveDocument(document.uri));
        }
      }

      await Promise.all(savePromises);
      this.logInfo(`Saved ${savePromises.length} documents`);
    } catch (error) {
      this.logError('Failed to save all documents', error);
      throw error;
    }
  }

  /**
   * Get a document by URI
   */
  public getDocument(uri: vscode.Uri): IMarkdownDocument | undefined {
    return this.documents.get(uri.toString());
  }

  /**
   * Get all open documents
   */
  public getAllDocuments(): IMarkdownDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Check if a document is open
   */
  public hasDocument(uri: vscode.Uri): boolean {
    return this.documents.has(uri.toString());
  }

  /**
   * Add a change listener
   */
  public addChangeListener(listener: DocumentChangeListener): vscode.Disposable {
    this.changeListeners.push(listener);
    
    return new vscode.Disposable(() => {
      const index = this.changeListeners.indexOf(listener);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    });
  }

  /**
   * Refresh a document from disk
   */
  public async refreshDocument(uri: vscode.Uri): Promise<void> {
    try {
      this.logInfo(`Refreshing document: ${uri.fsPath}`);

      const document = this.getDocument(uri);
      if (!document) {
        throw new Error(`Document not found: ${uri.fsPath}`);
      }

      // Read latest content from disk
      const content = await this.readFileContent(uri);
      
      // Update document content
      document.updateContent(content);
      document.markClean(); // Fresh from disk, so it's clean

      // Notify listeners
      this.notifyChangeListeners({
        document,
        type: 'external',
        timestamp: new Date()
      });

      this.logInfo(`Document refreshed successfully: ${uri.fsPath}`);
    } catch (error) {
      this.logError(`Failed to refresh document: ${uri.fsPath}`, error);
      throw error;
    }
  }

  /**
   * Dispose the document manager
   */
  public dispose(): void {
    try {
      this.logInfo('Disposing Document Manager...');

      // Dispose all file watchers
      for (const watcher of this.watchers.values()) {
        watcher.dispose();
      }
      this.watchers.clear();

      // Dispose event listeners
      for (const disposable of this.disposables) {
        disposable.dispose();
      }
      this.disposables = [];

      // Clear documents
      this.documents.clear();
      this.changeListeners = [];

      this.isInitialized = false;
      this.logInfo('Document Manager disposed successfully');
    } catch (error) {
      this.logError('Failed to dispose Document Manager', error);
    }
  }

  /**
   * Set up file watching for a document
   */
  private watchDocument(document: MarkdownDocument): void {
    try {
      const watcher = vscode.workspace.createFileSystemWatcher(
        document.uri.fsPath
      );

      // Handle file changes
      watcher.onDidChange(() => this.handleDocumentChange(document));
      watcher.onDidDelete(() => this.handleDocumentDelete(document));

      this.watchers.set(document.id, watcher);
      this.logInfo(`File watching enabled for: ${document.uri.fsPath}`);
    } catch (error) {
      this.logError(`Failed to set up file watching for: ${document.uri.fsPath}`, error);
    }
  }

  /**
   * Handle external document changes
   */
  private async handleDocumentChange(document: MarkdownDocument): Promise<void> {
    try {
      this.logInfo(`External change detected: ${document.uri.fsPath}`);

      // Check if document has unsaved changes
      if (document.isDirty) {
        // Show user notification about conflict
        const action = await vscode.window.showWarningMessage(
          `The file "${document.uri.fsPath}" has been changed on disk but has unsaved changes. What would you like to do?`,
          'Reload from disk',
          'Keep my changes',
          'Compare'
        );

        switch (action) {
          case 'Reload from disk':
            await this.refreshDocument(document.uri);
            break;
          case 'Keep my changes':
            // Do nothing, keep current changes
            break;
          case 'Compare':
            // Open diff view (placeholder for now)
            vscode.window.showInformationMessage('Compare functionality will be implemented in a future update');
            break;
        }
      } else {
        // No local changes, safe to reload
        await this.refreshDocument(document.uri);
      }
    } catch (error) {
      this.logError(`Failed to handle document change: ${document.uri.fsPath}`, error);
    }
  }

  /**
   * Handle document deletion
   */
  private async handleDocumentDelete(document: MarkdownDocument): Promise<void> {
    try {
      this.logWarning(`Document deleted externally: ${document.uri.fsPath}`);
      
      // Show notification to user
      vscode.window.showWarningMessage(
        `The file "${document.uri.fsPath}" has been deleted from disk.`
      );
      
      // Close the document
      await this.closeDocument(document.uri);
    } catch (error) {
      this.logError(`Failed to handle document deletion: ${document.uri.fsPath}`, error);
    }
  }

  /**
   * Handle VS Code text document changes
   */
  private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.document.languageId !== 'markdown') {
      return;
    }

    const document = this.getDocument(event.document.uri);
    if (document) {
      // Update content if it changed
      const newContent = event.document.getText();
      if (document.content !== newContent) {
        document.updateContent(newContent);
        
        // Notify listeners
        this.notifyChangeListeners({
          document,
          type: 'content',
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Handle VS Code document saves
   */
  private handleDocumentSave(event: vscode.TextDocument): void {
    if (event.languageId !== 'markdown') {
      return;
    }

    const document = this.getDocument(event.uri);
    if (document) {
      document.markClean();
      
      // Notify listeners
      this.notifyChangeListeners({
        document,
        type: 'state',
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle VS Code document closes
   */
  private handleDocumentClose(event: vscode.TextDocument): void {
    if (event.languageId !== 'markdown') {
      return;
    }

    // Close our document if it exists
    this.closeDocument(event.uri).catch(error => {
      this.logError(`Failed to close document: ${event.uri.fsPath}`, error);
    });
  }

  /**
   * Read file content from disk
   */
  private async readFileContent(uri: vscode.Uri): Promise<string> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return content.toString();
    } catch (error) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        // File doesn't exist, return empty content
        return '';
      }
      throw error;
    }
  }

  /**
   * Notify change listeners
   */
  private notifyChangeListeners(event: DocumentChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        this.logError('Error in change listener', error);
      }
    }
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic DocumentManager] ${message}`);
  }

  /**
   * Log warning messages
   */
  private logWarning(message: string): void {
    console.warn(`[mdMagic DocumentManager Warning] ${message}`);
  }

  /**
   * Log error messages
   */
  private logError(message: string, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[mdMagic DocumentManager Error] ${message}: ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic DocumentManager Error Stack] ${error.stack}`);
    }
  }
}