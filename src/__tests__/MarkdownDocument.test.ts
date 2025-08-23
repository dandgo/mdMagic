/**
 * Unit tests for MarkdownDocument
 */

// Mock VS Code API first
const mockVscode = {
  Uri: {
    file: jest.fn((path: string) => ({ toString: () => path, fsPath: path })),
  },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

import { MarkdownDocument, EditorMode, Position, Range } from '../managers/MarkdownDocument';

describe('MarkdownDocument', () => {
  let mockUri: any;
  let document: MarkdownDocument;

  beforeEach(() => {
    mockUri = mockVscode.Uri.file('/test/document.md');
    document = new MarkdownDocument(mockUri, '# Test Document\n\nHello world!');
  });

  describe('constructor', () => {
    it('should create document with initial content', () => {
      expect(document.id).toBe('/test/document.md');
      expect(document.uri).toBe(mockUri);
      expect(document.content).toBe('# Test Document\n\nHello world!');
      expect(document.mode).toBe(EditorMode.Editor);
      expect(document.isDirty).toBe(false);
    });

    it('should create document with default values', () => {
      const emptyDoc = new MarkdownDocument(mockUri);

      expect(emptyDoc.content).toBe('');
      expect(emptyDoc.mode).toBe(EditorMode.Editor);
      expect(emptyDoc.isDirty).toBe(false);
      expect(emptyDoc.cursorPosition).toEqual({ line: 0, character: 0 });
      expect(emptyDoc.scrollPosition).toBe(0);
      expect(emptyDoc.selections).toEqual([]);
    });

    it('should create document with custom mode', () => {
      const viewerDoc = new MarkdownDocument(mockUri, 'content', EditorMode.Viewer);
      expect(viewerDoc.mode).toBe(EditorMode.Viewer);
    });
  });

  describe('content management', () => {
    it('should update content and mark dirty', () => {
      const newContent = '# Updated Content';
      const originalModified = document.lastModified;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        document.content = newContent;

        expect(document.content).toBe(newContent);
        expect(document.isDirty).toBe(true);
        expect(document.lastModified.getTime()).toBeGreaterThan(originalModified.getTime());
      }, 1);
    });

    it('should not mark dirty if content is same', () => {
      const originalContent = document.content;
      document.markClean();

      document.content = originalContent;

      expect(document.isDirty).toBe(false);
    });

    it('should update content via updateContent method', () => {
      const newContent = '# Method Update';

      document.updateContent(newContent);

      expect(document.content).toBe(newContent);
      expect(document.isDirty).toBe(true);
    });
  });

  describe('state management', () => {
    it('should manage dirty flag', () => {
      expect(document.isDirty).toBe(false);

      document.markDirty();
      expect(document.isDirty).toBe(true);

      document.markClean();
      expect(document.isDirty).toBe(false);
    });

    it('should manage cursor position', () => {
      const position: Position = { line: 5, character: 10 };

      document.cursorPosition = position;

      expect(document.cursorPosition).toEqual(position);
      // Should return a copy, not the same object
      expect(document.cursorPosition).not.toBe(position);
    });

    it('should update cursor position via method', () => {
      const position: Position = { line: 3, character: 7 };

      document.updateCursorPosition(position);

      expect(document.cursorPosition).toEqual(position);
    });

    it('should manage scroll position', () => {
      document.scrollPosition = 100;
      expect(document.scrollPosition).toBe(100);

      document.updateScrollPosition(200);
      expect(document.scrollPosition).toBe(200);
    });

    it('should manage selections', () => {
      const selections: Range[] = [
        { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
      ];

      document.selections = selections;

      expect(document.selections).toEqual(selections);
      // Should return copies, not the same objects
      expect(document.selections).not.toBe(selections);
      expect(document.selections[0]).not.toBe(selections[0]);
    });

    it('should update selections via method', () => {
      const selections: Range[] = [
        { start: { line: 2, character: 1 }, end: { line: 2, character: 6 } },
      ];

      document.updateSelections(selections);

      expect(document.selections).toEqual(selections);
    });
  });

  describe('mode management', () => {
    it('should change mode', () => {
      expect(document.mode).toBe(EditorMode.Editor);

      document.mode = EditorMode.Viewer;
      expect(document.mode).toBe(EditorMode.Viewer);

      document.mode = EditorMode.Split;
      expect(document.mode).toBe(EditorMode.Split);
    });
  });

  describe('state serialization', () => {
    it('should return complete state', () => {
      document.mode = EditorMode.Viewer;
      document.markDirty();
      document.updateCursorPosition({ line: 1, character: 5 });
      document.updateScrollPosition(50);

      const state = document.getState();

      expect(state).toEqual({
        id: document.id,
        uri: document.uri,
        content: document.content,
        mode: EditorMode.Viewer,
        isDirty: true,
        cursorPosition: { line: 1, character: 5 },
        scrollPosition: 50,
        selections: [],
        lastModified: document.lastModified,
      });
    });

    it('should return state copies, not references', () => {
      const state = document.getState();

      // Modify returned state
      state.cursorPosition.line = 999;
      state.selections.push({ start: { line: 0, character: 0 }, end: { line: 1, character: 1 } });

      // Original document should be unchanged
      expect(document.cursorPosition.line).toBe(0);
      expect(document.selections).toEqual([]);
    });
  });

  describe('validation', () => {
    it('should validate clean markdown', () => {
      document.content = '# Title\n\nThis is a paragraph.\n\n[link](http://example.com)';

      const result = document.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect script tags as errors', () => {
      document.content = 'Hello\n<script>alert("xss")</script>\nWorld';

      const result = document.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        line: 2,
        column: 1,
        message: 'Script tags are not allowed in markdown',
        severity: 'error',
      });
    });

    it('should detect empty links as warnings', () => {
      document.content = 'Check out [this link]() for more info.';

      const result = document.validate();

      expect(result.isValid).toBe(true); // warnings don't make it invalid
      expect(result.errors).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        line: 1,
        column: 11,
        message: 'Empty link URL detected',
        severity: 'warning',
      });
    });

    it('should detect multiple issues', () => {
      document.content = '[empty link]()\n<script>bad</script>\n[another empty]()';

      const result = document.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(2);
    });

    it('should handle empty content', () => {
      document.content = '';

      const result = document.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should return immutable copies of state objects', () => {
      const position = document.cursorPosition;
      const selections = document.selections;
      const lastModified = document.lastModified;

      // Modify returned objects
      position.line = 999;
      selections.push({ start: { line: 0, character: 0 }, end: { line: 1, character: 1 } });
      lastModified.setFullYear(2000);

      // Original document should be unchanged
      expect(document.cursorPosition.line).toBe(0);
      expect(document.selections).toEqual([]);
      expect(document.lastModified.getFullYear()).not.toBe(2000);
    });
  });
});
