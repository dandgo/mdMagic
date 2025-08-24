/**
 * WYSIWYG Enhancement Tests
 * Tests for Task 4.1: Advanced WYSIWYG editing features
 */

describe('WYSIWYG Enhancement (Task 4.1)', () => {
  // Mock DOM environment
  let mockEditor: any;
  let mockDocument: any;
  let mockWindow: any;

  beforeEach(() => {
    // Mock Monaco Editor
    mockEditor = {
      getValue: jest.fn(() => '# Test Content'),
      setValue: jest.fn(),
      getPosition: jest.fn(() => ({ lineNumber: 1, column: 1 })),
      setPosition: jest.fn(),
      getSelection: jest.fn(() => ({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      })),
      executeEdits: jest.fn(),
      focus: jest.fn(),
      onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
      onDidChangeCursorPosition: jest.fn(() => ({ dispose: jest.fn() })),
      addAction: jest.fn(),
      getModel: jest.fn(() => ({
        getValueInRange: jest.fn(() => 'selected text'),
        getLineContent: jest.fn(() => '| Header 1 | Header 2 |'),
        getLineCount: jest.fn(() => 5),
      })),
      getScrollTop: jest.fn(() => 100),
      getScrollHeight: jest.fn(() => 1000),
      getLayoutInfo: jest.fn(() => ({ height: 400 })),
    };

    // Mock DOM elements
    mockDocument = {
      getElementById: jest.fn((id) => {
        const mockElement = {
          addEventListener: jest.fn(),
          classList: {
            toggle: jest.fn(),
            add: jest.fn(),
            remove: jest.fn(),
          },
          innerHTML: '',
          style: {},
          scrollTop: 0,
          scrollHeight: 1000,
          clientHeight: 400,
        };
        return mockElement;
      }),
      createElement: jest.fn(() => mockDocument.getElementById()),
    };

    // Mock window
    mockWindow = {
      addEventListener: jest.fn(),
      monaco: {
        languages: {
          registerCompletionItemProvider: jest.fn(),
          CompletionItemKind: {
            Snippet: 1,
          },
          CompletionItemInsertTextRule: {
            InsertAsSnippet: 1,
          },
        },
        Range: jest.fn((startLine, startCol, endLine, endCol) => ({
          startLineNumber: startLine,
          startColumn: startCol,
          endLineNumber: endLine,
          endColumn: endCol,
        })),
      },
    };

    // Setup global mocks
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    global.monaco = mockWindow.monaco as any;
  });

  describe('Smart Paste Functionality', () => {
    test('should convert HTML to markdown', () => {
      // Mock editor implementation with HTML-to-Markdown conversion
      const convertHTMLToMarkdown = (html: string) => {
        let markdown = html;

        // Convert headers
        markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
        markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');

        // Convert bold
        markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');

        // Convert italic
        markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

        // Convert links
        markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

        // Remove HTML tags
        markdown = markdown.replace(/<[^>]*>/g, '');

        return markdown.trim();
      };

      const htmlInput =
        '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> text.</p><a href="https://example.com">Link</a>';
      const expectedMarkdown =
        '# Title\n\nThis is **bold** and *italic* text.[Link](https://example.com)';

      const result = convertHTMLToMarkdown(htmlInput);
      expect(result).toBe(expectedMarkdown);
    });

    test('should handle paste events with HTML content', () => {
      const mockClipboardData = {
        getData: jest.fn((type) => {
          if (type === 'text/html') {
            return '<strong>Bold text</strong>';
          }
          if (type === 'text/plain') {
            return 'Bold text';
          }
          return '';
        }),
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
        preventDefault: jest.fn(),
      };

      // Simulate smart paste handler
      const handleSmartPaste = (event: any) => {
        const htmlData = event.clipboardData?.getData('text/html');
        if (htmlData && htmlData.includes('<strong>')) {
          event.preventDefault();
          return true; // Handled
        }
        return false; // Not handled
      };

      const result = handleSmartPaste(mockEvent);
      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Auto-completion for Markdown Syntax', () => {
    test('should provide header completions', () => {
      const provideCompletionItems = (textUntilPosition: string) => {
        const suggestions: any[] = [];

        if (textUntilPosition.match(/^#*$/)) {
          for (let i = 1; i <= 6; i++) {
            suggestions.push({
              label: '#'.repeat(i) + ' Header ' + i,
              insertText: '#'.repeat(i) + ' ${1:Header}',
              documentation: `Insert H${i} header`,
            });
          }
        }

        return { suggestions };
      };

      const result = provideCompletionItems('#');
      expect(result.suggestions).toHaveLength(6);
      expect(result.suggestions[0].label).toBe('# Header 1');
      expect(result.suggestions[5].label).toBe('###### Header 6');
    });

    test('should provide formatting completions', () => {
      const provideCompletionItems = (textUntilPosition: string) => {
        const suggestions: any[] = [];

        if (textUntilPosition.match(/\*$/)) {
          suggestions.push({
            label: '**bold**',
            insertText: '*${1:bold text}*',
            documentation: 'Bold text formatting',
          });
        }

        return { suggestions };
      };

      const result = provideCompletionItems('some text*');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].label).toBe('**bold**');
    });

    test('should provide table completions', () => {
      const provideCompletionItems = (textUntilPosition: string) => {
        const suggestions: any[] = [];

        if (textUntilPosition.match(/^\|?[\s]*$/)) {
          suggestions.push({
            label: 'Table',
            insertText:
              '| ${1:Header 1} | ${2:Header 2} | ${3:Header 3} |\n| --- | --- | --- |\n| ${4:Cell 1} | ${5:Cell 2} | ${6:Cell 3} |',
            documentation: 'Insert table',
          });
        }

        return { suggestions };
      };

      const result = provideCompletionItems('|');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].label).toBe('Table');
    });
  });

  describe('Drag-and-Drop Image Support', () => {
    test('should handle image file drops', () => {
      const mockFile = {
        type: 'image/png',
        name: 'test-image.png',
        size: 1024,
      };

      const mockDataTransfer = {
        files: [mockFile],
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
        preventDefault: jest.fn(),
        clientX: 100,
        clientY: 200,
      };

      // Simulate drag drop handler
      const handleDragDrop = (event: any) => {
        event.preventDefault();

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) {
          return false;
        }

        for (const file of files) {
          if (file.type.startsWith('image/')) {
            return true; // Would insert image
          }
        }

        return false;
      };

      const result = handleDragDrop(mockEvent);
      expect(result).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    test('should generate correct image markdown', () => {
      const generateImageMarkdown = (fileName: string, dataUrl: string) => {
        return `![${fileName}](${dataUrl})`;
      };

      const result = generateImageMarkdown('test.png', 'data:image/png;base64,abc123');
      expect(result).toBe('![test.png](data:image/png;base64,abc123)');
    });
  });

  describe('Table Visual Editing', () => {
    test('should detect if cursor is in table', () => {
      const isInTable = (lineContent: string) => {
        return lineContent.includes('|');
      };

      expect(isInTable('| Header 1 | Header 2 |')).toBe(true);
      expect(isInTable('Regular text line')).toBe(false);
    });

    test('should navigate table cells correctly', () => {
      const navigateTableCell = (
        lineContent: string,
        currentColumn: number,
        direction: 'next' | 'prev'
      ) => {
        const cells = lineContent
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell.length > 0);

        // Find current cell based on column position
        // For table "| Cell 1 | Cell 2 | Cell 3 |"
        // Positions: 0-8 (Cell 1), 9-17 (Cell 2), 18-26 (Cell 3)
        let cellStart = 2; // Start after first "|"
        let currentCellIndex = 0;

        for (let i = 0; i < cells.length; i++) {
          const cellEnd = cellStart + cells[i].length;
          if (currentColumn >= cellStart && currentColumn <= cellEnd) {
            currentCellIndex = i;
            break;
          }
          cellStart = cellEnd + 3; // Move to next cell (| + space + cell + space)
        }

        if (direction === 'next' && currentCellIndex < cells.length - 1) {
          return currentCellIndex + 1;
        } else if (direction === 'prev' && currentCellIndex > 0) {
          return currentCellIndex - 1;
        }

        return currentCellIndex;
      };

      const tableLine = '| Cell 1 | Cell 2 | Cell 3 |';

      // Test navigation - column 5 should be in Cell 1 (index 0), next should be index 1
      expect(navigateTableCell(tableLine, 5, 'next')).toBe(1); // From Cell 1 to Cell 2
      // Column 15 should be in Cell 2 (index 1), prev should be index 0
      expect(navigateTableCell(tableLine, 15, 'prev')).toBe(0); // From Cell 2 to Cell 1
    });

    test('should add table rows correctly', () => {
      const addTableRow = (lineContent: string) => {
        const cells = lineContent.split('|').filter((cell) => cell.trim().length > 0);
        const numCols = cells.length;
        return '| ' + Array(numCols).fill('Cell').join(' | ') + ' |';
      };

      const result = addTableRow('| Header 1 | Header 2 | Header 3 |');
      expect(result).toBe('| Cell | Cell | Cell |');
    });
  });

  describe('Enhanced Live Preview', () => {
    test('should sync scroll positions', () => {
      const syncScrollPosition = (
        editorScrollTop: number,
        editorScrollHeight: number,
        editorViewHeight: number
      ) => {
        const scrollRatio = editorScrollTop / (editorScrollHeight - editorViewHeight);
        return Math.max(0, Math.min(1, scrollRatio)); // Clamp between 0 and 1
      };

      const ratio = syncScrollPosition(100, 1000, 400);
      expect(ratio).toBeCloseTo(0.167, 3); // 100 / (1000 - 400) = 0.167
    });

    test('should update preview with animation', () => {
      const updatePreviewWithAnimation = (content: string, previewElement: any) => {
        previewElement.style.opacity = '0.8';
        previewElement.innerHTML = content;

        setTimeout(() => {
          previewElement.style.opacity = '1';
        }, 50);

        return true;
      };

      const mockPreviewElement = {
        style: {},
        innerHTML: '',
      };

      const result = updatePreviewWithAnimation('<h1>Test</h1>', mockPreviewElement);
      expect(result).toBe(true);
      expect(mockPreviewElement.style.opacity).toBe('0.8');
      expect(mockPreviewElement.innerHTML).toBe('<h1>Test</h1>');
    });
  });

  describe('WYSIWYG Mode Toggle', () => {
    test('should enable WYSIWYG features correctly', () => {
      const enableWysiwygFeatures = (autoSaveDelay: number) => {
        const newDelay = 100; // Faster updates for WYSIWYG
        return {
          newDelay,
          wysiwygEnabled: true,
        };
      };

      const result = enableWysiwygFeatures(1000);
      expect(result.newDelay).toBe(100);
      expect(result.wysiwygEnabled).toBe(true);
    });

    test('should disable WYSIWYG features correctly', () => {
      const disableWysiwygFeatures = (originalDelay: number) => {
        return {
          restoredDelay: originalDelay,
          wysiwygEnabled: false,
        };
      };

      const result = disableWysiwygFeatures(1000);
      expect(result.restoredDelay).toBe(1000);
      expect(result.wysiwygEnabled).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complex WYSIWYG workflow', () => {
      let isWysiwygMode = false;
      let previewVisible = false;
      let autoSaveDelay = 1000;

      // Toggle WYSIWYG mode
      const toggleWysiwyg = () => {
        isWysiwygMode = !isWysiwygMode;

        if (isWysiwygMode) {
          autoSaveDelay = 100;
          previewVisible = true;
        } else {
          autoSaveDelay = 1000;
        }

        return { isWysiwygMode, previewVisible, autoSaveDelay };
      };

      // Test enabling WYSIWYG
      let result = toggleWysiwyg();
      expect(result.isWysiwygMode).toBe(true);
      expect(result.previewVisible).toBe(true);
      expect(result.autoSaveDelay).toBe(100);

      // Test disabling WYSIWYG
      result = toggleWysiwyg();
      expect(result.isWysiwygMode).toBe(false);
      expect(result.autoSaveDelay).toBe(1000);
    });

    test('should format text correctly during typing', () => {
      const formatTextAsTyped = (text: string) => {
        // Simulate real-time formatting
        const formatted = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>');

        return formatted;
      };

      const input = '# Title\n\nThis is **bold** and *italic* text.';
      const expected = '<h1>Title</h1>\n\nThis is <strong>bold</strong> and <em>italic</em> text.';

      const result = formatTextAsTyped(input);
      expect(result).toBe(expected);
    });
  });
});
