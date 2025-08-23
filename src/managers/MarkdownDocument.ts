/**
 * MarkdownDocument - Represents a markdown document with state management
 * Handles document content, metadata, and state tracking
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
  scrollPosition: number;
  selections: Range[];
  lastModified: Date;
}

export interface IMarkdownDocument {
  readonly id: string;
  readonly uri: vscode.Uri;
  content: string;
  mode: EditorMode;
  isDirty: boolean;
  cursorPosition: Position;
  scrollPosition: number;
  selections: Range[];
  lastModified: Date;

  updateContent(content: string): void;
  markDirty(): void;
  markClean(): void;
  updateCursorPosition(position: Position): void;
  updateScrollPosition(position: number): void;
  updateSelections(selections: Range[]): void;
  getState(): MarkdownDocumentState;
  validate(): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export class MarkdownDocument implements IMarkdownDocument {
  private _content: string;
  private _mode: EditorMode;
  private _isDirty: boolean;
  private _cursorPosition: Position;
  private _scrollPosition: number;
  private _selections: Range[];
  private _lastModified: Date;

  constructor(
    public readonly uri: vscode.Uri,
    initialContent: string = '',
    initialMode: EditorMode = EditorMode.Editor
  ) {
    this._content = initialContent;
    this._mode = initialMode;
    this._isDirty = false;
    this._cursorPosition = { line: 0, character: 0 };
    this._scrollPosition = 0;
    this._selections = [];
    this._lastModified = new Date();
  }

  public get id(): string {
    return this.uri.toString();
  }

  public get content(): string {
    return this._content;
  }

  public set content(value: string) {
    if (this._content !== value) {
      this._content = value;
      this.markDirty();
      this._lastModified = new Date();
    }
  }

  public get mode(): EditorMode {
    return this._mode;
  }

  public set mode(value: EditorMode) {
    this._mode = value;
  }

  public get isDirty(): boolean {
    return this._isDirty;
  }

  public set isDirty(value: boolean) {
    this._isDirty = value;
  }

  public get cursorPosition(): Position {
    return { ...this._cursorPosition };
  }

  public set cursorPosition(value: Position) {
    this._cursorPosition = { ...value };
  }

  public get scrollPosition(): number {
    return this._scrollPosition;
  }

  public set scrollPosition(value: number) {
    this._scrollPosition = value;
  }

  public get selections(): Range[] {
    return this._selections.map((sel) => ({ ...sel }));
  }

  public set selections(value: Range[]) {
    this._selections = value.map((sel) => ({ ...sel }));
  }

  public get lastModified(): Date {
    return new Date(this._lastModified);
  }

  public updateContent(content: string): void {
    this.content = content;
  }

  public markDirty(): void {
    this._isDirty = true;
  }

  public markClean(): void {
    this._isDirty = false;
  }

  public updateCursorPosition(position: Position): void {
    this._cursorPosition = { ...position };
  }

  public updateScrollPosition(position: number): void {
    this._scrollPosition = position;
  }

  public updateSelections(selections: Range[]): void {
    this._selections = selections.map((sel) => ({ ...sel }));
  }

  public getState(): MarkdownDocumentState {
    return {
      id: this.id,
      uri: this.uri,
      content: this._content,
      mode: this._mode,
      isDirty: this._isDirty,
      cursorPosition: { ...this._cursorPosition },
      scrollPosition: this._scrollPosition,
      selections: this._selections.map((sel) => ({ ...sel })),
      lastModified: new Date(this._lastModified),
    };
  }

  public validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Basic markdown validation
    const lines = this._content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for potential issues
      if (line.includes('<script>')) {
        errors.push({
          line: i + 1,
          column: line.indexOf('<script>') + 1,
          message: 'Script tags are not allowed in markdown',
          severity: 'error',
        });
      }

      // Check for malformed links
      const linkMatches = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
      if (linkMatches) {
        linkMatches.forEach((match) => {
          const linkMatch = match.match(/\[([^\]]*)\]\(([^)]*)\)/);
          if (linkMatch && linkMatch[2].trim() === '') {
            warnings.push({
              line: i + 1,
              column: line.indexOf(match) + 1,
              message: 'Empty link URL detected',
              severity: 'warning',
            });
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
