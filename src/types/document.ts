/**
 * Document-related type definitions
 */

import * as vscode from 'vscode';

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export enum EditorMode {
  Editor = 'editor',
  Viewer = 'viewer',
  Split = 'split',
}

export interface MarkdownDocumentState {
  id: string;
  uri: vscode.Uri;
  content: string;
  mode: EditorMode;
  isDirty: boolean;
  cursorPosition: Position;
  lastModified: Date;
  lineCount: number;
  wordCount: number;
  charCount: number;
  selection: Range | null;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  tags?: string[];
  created?: Date;
  modified?: Date;
  size?: number;
}

export interface MarkdownDocument extends MarkdownDocumentState {
  metadata: DocumentMetadata;
}