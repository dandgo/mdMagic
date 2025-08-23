/**
 * ModeManager - Manages editor/viewer mode switching with state preservation
 * Handles mode transitions, state persistence, and mode-specific configurations
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';
import { EditorMode } from './MarkdownDocument';
import { IDocumentManager } from './DocumentManager';
import { IConfigManager } from './ConfigManager';

export interface ModeChangeEvent {
  documentId: string;
  previousMode: EditorMode;
  currentMode: EditorMode;
  timestamp: Date;
}

export type ModeChangeListener = (event: ModeChangeEvent) => void;

export interface DocumentModeState {
  documentId: string;
  mode: EditorMode;
  cursorPosition?: { line: number; character: number };
  scrollPosition?: number;
  lastSwitched: Date;
}

export interface IModeManager extends Component {
  getCurrentMode(documentId: string): EditorMode;
  switchMode(documentId: string, targetMode: EditorMode): Promise<void>;
  registerModeChangeListener(listener: ModeChangeListener): vscode.Disposable;
  canSwitchMode(documentId: string, targetMode: EditorMode): boolean;
  getDocumentModeState(documentId: string): DocumentModeState | undefined;
  setDefaultMode(documentId: string): Promise<void>;
}

export class ModeManager implements IModeManager {
  public readonly id = 'mode-manager';
  public readonly name = 'Mode Manager';

  private documentModes = new Map<string, DocumentModeState>();
  private modeChangeListeners: ModeChangeListener[] = [];
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  constructor(
    private context: vscode.ExtensionContext,
    private documentManager: IDocumentManager,
    private configManager: IConfigManager
  ) {}

  /**
   * Initialize the mode manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logInfo('Initializing Mode Manager...');

      // Listen for configuration changes to update default modes
      this.disposables.push(
        this.configManager.addChangeListener((event) => {
          if (event.key === 'defaultMode') {
            this.handleDefaultModeChange(event.newValue as EditorMode);
          }
        })
      );

      // Listen for document changes to track mode state
      this.disposables.push(
        this.documentManager.addChangeListener((event) => {
          this.handleDocumentChange(event);
        })
      );

      this.isInitialized = true;
      this.logInfo('Mode Manager initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Mode Manager', error);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.logInfo('Disposing Mode Manager...');

    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.modeChangeListeners = [];
    this.documentModes.clear();

    this.logInfo('Mode Manager disposed successfully');
  }

  /**
   * Get the current mode for a document
   */
  public getCurrentMode(documentId: string): EditorMode {
    const modeState = this.documentModes.get(documentId);
    if (modeState) {
      return modeState.mode;
    }

    // Return default mode from configuration
    const defaultMode = this.configManager.getConfigurationValue('defaultMode');
    return defaultMode === 'editor' ? EditorMode.Editor : EditorMode.Viewer;
  }

  /**
   * Switch mode for a document with state preservation
   */
  public async switchMode(documentId: string, targetMode: EditorMode): Promise<void> {
    if (!this.canSwitchMode(documentId, targetMode)) {
      this.logWarning(`Cannot switch to mode ${targetMode} for document ${documentId}`);
      return;
    }

    const currentMode = this.getCurrentMode(documentId);
    if (currentMode === targetMode) {
      this.logInfo(`Document ${documentId} already in ${targetMode} mode`);
      return;
    }

    try {
      this.logInfo(`Switching document ${documentId} from ${currentMode} to ${targetMode}`);

      // Save current state before switching
      const currentState = await this.saveCurrentState(documentId, currentMode);

      // Update mode state
      const modeState: DocumentModeState = {
        documentId,
        mode: targetMode,
        cursorPosition: currentState?.cursorPosition,
        scrollPosition: currentState?.scrollPosition,
        lastSwitched: new Date(),
      };

      this.documentModes.set(documentId, modeState);

      // Update document mode
      const document = this.documentManager.getDocument(vscode.Uri.parse(documentId));
      if (document) {
        document.mode = targetMode;
      }

      // Notify listeners
      this.notifyModeChange(documentId, currentMode, targetMode);

      // Apply mode-specific configurations
      await this.applyModeConfiguration(documentId, targetMode);

      // Restore state in new mode
      await this.restoreState(documentId, targetMode, currentState);

      this.logInfo(`Successfully switched document ${documentId} to ${targetMode} mode`);
    } catch (error) {
      this.logError(`Failed to switch mode for document ${documentId}`, error);
      throw error;
    }
  }

  /**
   * Register a mode change listener
   */
  public registerModeChangeListener(listener: ModeChangeListener): vscode.Disposable {
    this.modeChangeListeners.push(listener);

    return new vscode.Disposable(() => {
      const index = this.modeChangeListeners.indexOf(listener);
      if (index !== -1) {
        this.modeChangeListeners.splice(index, 1);
      }
    });
  }

  /**
   * Check if mode switching is allowed
   */
  public canSwitchMode(documentId: string, targetMode: EditorMode): boolean {
    // Check if document exists
    const document = this.documentManager.getDocument(vscode.Uri.parse(documentId));
    if (!document) {
      return false;
    }

    // All mode switches are allowed for now
    // In the future, this could check for document state, unsaved changes, etc.
    return true;
  }

  /**
   * Get the mode state for a document
   */
  public getDocumentModeState(documentId: string): DocumentModeState | undefined {
    return this.documentModes.get(documentId);
  }

  /**
   * Set document to default mode from configuration
   */
  public async setDefaultMode(documentId: string): Promise<void> {
    const defaultMode = this.configManager.getConfigurationValue('defaultMode');
    const targetMode = defaultMode === 'editor' ? EditorMode.Editor : EditorMode.Viewer;
    await this.switchMode(documentId, targetMode);
  }

  /**
   * Save current state before mode switch
   */
  private async saveCurrentState(
    documentId: string,
    currentMode: EditorMode
  ): Promise<{ cursorPosition?: { line: number; character: number }; scrollPosition?: number } | null> {
    try {
      const document = this.documentManager.getDocument(vscode.Uri.parse(documentId));
      if (!document) {
        return null;
      }

      return {
        cursorPosition: document.cursorPosition,
        scrollPosition: document.scrollPosition,
      };
    } catch (error) {
      this.logError(`Failed to save state for document ${documentId}`, error);
      return null;
    }
  }

  /**
   * Restore state after mode switch
   */
  private async restoreState(
    documentId: string,
    targetMode: EditorMode,
    state: { cursorPosition?: { line: number; character: number }; scrollPosition?: number } | null
  ): Promise<void> {
    if (!state) {
      return;
    }

    try {
      const document = this.documentManager.getDocument(vscode.Uri.parse(documentId));
      if (!document) {
        return;
      }

      // Restore cursor position
      if (state.cursorPosition) {
        document.updateCursorPosition(state.cursorPosition);
      }

      // Restore scroll position
      if (state.scrollPosition !== undefined) {
        document.updateScrollPosition(state.scrollPosition);
      }

      this.logInfo(`Restored state for document ${documentId} in ${targetMode} mode`);
    } catch (error) {
      this.logError(`Failed to restore state for document ${documentId}`, error);
    }
  }

  /**
   * Apply mode-specific configuration
   */
  private async applyModeConfiguration(documentId: string, mode: EditorMode): Promise<void> {
    try {
      // Get mode-specific settings from configuration
      const config = this.configManager.getConfiguration();

      // Apply mode-specific configurations
      // This could include toolbar visibility, theme settings, etc.
      switch (mode) {
        case EditorMode.Editor:
          // Editor-specific configurations
          break;
        case EditorMode.Viewer:
          // Viewer-specific configurations
          break;
        case EditorMode.Split:
          // Split-view-specific configurations
          break;
      }

      this.logInfo(`Applied ${mode} mode configuration for document ${documentId}`);
    } catch (error) {
      this.logError(`Failed to apply mode configuration for document ${documentId}`, error);
    }
  }

  /**
   * Notify mode change listeners
   */
  private notifyModeChange(documentId: string, previousMode: EditorMode, currentMode: EditorMode): void {
    const event: ModeChangeEvent = {
      documentId,
      previousMode,
      currentMode,
      timestamp: new Date(),
    };

    this.modeChangeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logError('Error in mode change listener', error);
      }
    });
  }

  /**
   * Handle configuration changes for default mode
   */
  private handleDefaultModeChange(newDefaultMode: EditorMode): void {
    this.logInfo(`Default mode changed to ${newDefaultMode}`);
    // Could optionally update existing documents to new default mode
  }

  /**
   * Handle document changes to update mode tracking
   */
  private handleDocumentChange(event: any): void {
    if (event.type === 'state') {
      const documentId = event.document.id;
      const modeState = this.documentModes.get(documentId);
      
      if (modeState) {
        // Update our tracking state
        modeState.cursorPosition = event.document.cursorPosition;
        modeState.scrollPosition = event.document.scrollPosition;
      }
    }
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic ModeManager] ${message}`);
  }

  /**
   * Log warning messages
   */
  private logWarning(message: string): void {
    console.warn(`[mdMagic ModeManager Warning] ${message}`);
  }

  /**
   * Log error messages
   */
  private logError(message: string, error?: unknown): void {
    console.error(`[mdMagic ModeManager Error] ${message}`);

    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic ModeManager Error Stack] ${error.stack}`);
    }
  }
}