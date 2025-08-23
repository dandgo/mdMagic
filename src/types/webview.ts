/**
 * Webview communication types and interfaces
 */

import * as vscode from 'vscode';

export enum EditorMode {
  EDITOR = 'editor',
  VIEWER = 'viewer',
  SPLIT = 'split',
}

export enum MessageType {
  CONTENT_CHANGED = 'contentChanged',
  MODE_SWITCH = 'modeSwitch',
  SAVE_DOCUMENT = 'saveDocument',
  EXECUTE_COMMAND = 'executeCommand',
  UPDATE_CONFIG = 'updateConfig',
  WEBVIEW_READY = 'webviewReady',
  ERROR = 'error',
}

export interface WebviewMessage {
  type: MessageType;
  payload: any;
  requestId?: string;
}

export interface WebviewState {
  documentId: string;
  mode: EditorMode;
  content: string;
  cursorPosition?: { line: number; column: number };
  scrollPosition?: number;
  isDirty: boolean;
  lastModified: Date;
}

export interface WebviewOptions {
  enableScripts: boolean;
  retainContextWhenHidden: boolean;
  localResourceRoots: vscode.Uri[];
  enableFindWidget?: boolean;
  enableCommandUris?: boolean;
}

export interface WebviewPanelInfo {
  id: string;
  title: string;
  documentId: string;
  mode: EditorMode;
  panel: any; // vscode.WebviewPanel - using any to avoid circular dependency
  state: WebviewState;
  isActive: boolean;
  isVisible: boolean;
}
