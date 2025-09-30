/**
 * Mode-related type definitions
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';
import { EditorMode } from './document';

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
  switchMode(documentId: string, mode: EditorMode): Promise<void>;
  canSwitchMode(documentId: string, targetMode: EditorMode): boolean;
  registerModeChangeListener(listener: ModeChangeListener): vscode.Disposable;
  removeModeChangeListener(listener: ModeChangeListener): void;
  getDocumentModeState(documentId: string): DocumentModeState | undefined;
}