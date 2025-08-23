/**
 * Monaco Editor Loader for VS Code Webview
 * Handles Monaco Editor initialization with proper CSP compliance
 */

class MonacoEditorLoader {
  constructor() {
    this.isLoaded = false;
    this.loadPromise = null;
    this.editor = null;
    this.onLoadCallbacks = [];
  }

  /**
   * Load Monaco Editor
   */
  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadMonaco();
    return this.loadPromise;
  }

  /**
   * Initialize Monaco Editor instance
   */
  async createEditor(container, options = {}) {
    await this.load();

    if (!container) {
      throw new Error('Container element is required');
    }

    const defaultOptions = {
      language: 'markdown',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      folding: true,
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      ...options
    };

    // Create the editor
    this.editor = monaco.editor.create(container, defaultOptions);

    // Set up editor themes based on VS Code theme
    this._setupThemes();

    return this.editor;
  }

  /**
   * Get the current editor instance
   */
  getEditor() {
    return this.editor;
  }

  /**
   * Register a callback for when Monaco is loaded
   */
  onLoad(callback) {
    if (this.isLoaded && this.editor) {
      callback(this.editor);
    } else {
      this.onLoadCallbacks.push(callback);
    }
  }

  /**
   * Dispose of the editor
   */
  dispose() {
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }

  /**
   * Private method to load Monaco Editor
   */
  async _loadMonaco() {
    try {
      // Since we can't use CDN due to CSP, we'll create a simplified Monaco-like editor
      // This is a fallback approach that provides Monaco-like features
      
      // Create a global monaco object with essential APIs
      window.monaco = {
        editor: {
          create: this._createSimpleEditor.bind(this),
          createModel: this._createModel.bind(this),
          setTheme: this._setTheme.bind(this),
          defineTheme: this._defineTheme.bind(this),
          getModels: () => this._models || [],
          onDidCreateModel: () => ({ dispose: () => {} }),
          onWillDisposeModel: () => ({ dispose: () => {} })
        },
        languages: {
          register: () => {},
          setLanguageConfiguration: () => {},
          setMonarchTokensProvider: () => {},
          registerCompletionItemProvider: () => ({ dispose: () => {} }),
          registerHoverProvider: () => ({ dispose: () => {} })
        },
        Range: class Range {
          constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
          }
        },
        Position: class Position {
          constructor(lineNumber, column) {
            this.lineNumber = lineNumber;
            this.column = column;
          }
        },
        Selection: class Selection {
          constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
          }
        }
      };

      this._models = [];
      this.isLoaded = true;
      
      // Trigger callbacks
      this.onLoadCallbacks.forEach(callback => {
        try {
          callback(this.editor);
        } catch (error) {
          console.error('Error in Monaco load callback:', error);
        }
      });
      
      console.log('Monaco Editor (simplified) loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load Monaco Editor:', error);
      throw error;
    }
  }

  /**
   * Create a simplified Monaco-like editor
   */
  _createSimpleEditor(container, options = {}) {
    const textarea = document.createElement('textarea');
    textarea.className = 'monaco-editor-textarea';
    
    // Apply styles to make it look like Monaco
    Object.assign(textarea.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      outline: 'none',
      resize: 'none',
      fontFamily: options.fontFamily || 'Consolas, "Courier New", monospace',
      fontSize: (options.fontSize || 14) + 'px',
      backgroundColor: 'var(--vscode-editor-background)',
      color: 'var(--vscode-editor-foreground)',
      padding: '8px',
      lineHeight: '1.5',
      tabSize: options.tabSize || 2
    });

    // Set initial value
    if (options.value) {
      textarea.value = options.value;
    }

    // Clear container and add textarea
    container.innerHTML = '';
    container.appendChild(textarea);

    // Create Monaco-like API
    const editor = {
      _textarea: textarea,
      _container: container,
      _model: this._createModel(options.value || '', options.language || 'markdown'),
      _options: options,
      _decorations: [],
      _onDidChangeContent: [],
      _onDidChangeCursorPosition: [],

      // Core API methods
      getValue: () => textarea.value,
      setValue: (value) => {
        textarea.value = value;
        editor._model.value = value;
        editor._triggerContentChange();
      },
      getModel: () => editor._model,
      setModel: (model) => {
        editor._model = model;
        textarea.value = model.value;
        editor._triggerContentChange();
      },
      getPosition: () => {
        const lines = textarea.value.substr(0, textarea.selectionStart).split('\n');
        return {
          lineNumber: lines.length,
          column: lines[lines.length - 1].length + 1
        };
      },
      setPosition: (position) => {
        const lines = textarea.value.split('\n');
        let offset = 0;
        for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
          offset += lines[i].length + 1; // +1 for newline
        }
        offset += position.column - 1;
        textarea.setSelectionRange(offset, offset);
        textarea.focus();
      },
      getSelection: () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lines = textarea.value.split('\n');
        
        let startLine = 1, startCol = 1, endLine = 1, endCol = 1;
        let currentOffset = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (currentOffset + lines[i].length >= start && startLine === 1) {
            startLine = i + 1;
            startCol = start - currentOffset + 1;
          }
          if (currentOffset + lines[i].length >= end) {
            endLine = i + 1;
            endCol = end - currentOffset + 1;
            break;
          }
          currentOffset += lines[i].length + 1;
        }
        
        return {
          startLineNumber: startLine,
          startColumn: startCol,
          endLineNumber: endLine,
          endColumn: endCol
        };
      },
      setSelection: (selection) => {
        // Convert Monaco selection to textarea selection
        const lines = textarea.value.split('\n');
        let startOffset = 0, endOffset = 0;
        
        for (let i = 0; i < selection.startLineNumber - 1 && i < lines.length; i++) {
          startOffset += lines[i].length + 1;
        }
        startOffset += selection.startColumn - 1;
        
        for (let i = 0; i < selection.endLineNumber - 1 && i < lines.length; i++) {
          endOffset += lines[i].length + 1;
        }
        endOffset += selection.endColumn - 1;
        
        textarea.setSelectionRange(startOffset, endOffset);
      },
      focus: () => textarea.focus(),
      layout: () => {}, // No-op for simplified editor
      dispose: () => {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      },

      // Event handling
      onDidChangeModelContent: (callback) => {
        editor._onDidChangeContent.push(callback);
        return { dispose: () => {
          const index = editor._onDidChangeContent.indexOf(callback);
          if (index > -1) {
            editor._onDidChangeContent.splice(index, 1);
          }
        }};
      },
      onDidChangeCursorPosition: (callback) => {
        editor._onDidChangeCursorPosition.push(callback);
        return { dispose: () => {
          const index = editor._onDidChangeCursorPosition.indexOf(callback);
          if (index > -1) {
            editor._onDidChangeCursorPosition.splice(index, 1);
          }
        }};
      },

      // Action support
      addAction: (action) => {
        // Simple keyboard shortcut handling
        if (action.keybindings) {
          textarea.addEventListener('keydown', (e) => {
            const keybinding = action.keybindings[0];
            if (this._matchesKeybinding(e, keybinding)) {
              e.preventDefault();
              action.run(editor);
            }
          });
        }
        return { dispose: () => {} };
      },

      // Internal methods
      _triggerContentChange: () => {
        const event = {
          changes: [{
            text: textarea.value,
            range: null,
            rangeLength: 0,
            rangeOffset: 0
          }]
        };
        editor._onDidChangeContent.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('Error in content change callback:', error);
          }
        });
      }
    };

    // Set up event listeners
    textarea.addEventListener('input', () => {
      editor._model.value = textarea.value;
      editor._triggerContentChange();
    });

    textarea.addEventListener('selectionchange', () => {
      const position = editor.getPosition();
      editor._onDidChangeCursorPosition.forEach(callback => {
        try {
          callback({ position });
        } catch (error) {
          console.error('Error in cursor position callback:', error);
        }
      });
    });

    return editor;
  }

  /**
   * Create a model
   */
  _createModel(value, language) {
    const model = {
      id: 'model_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      value: value || '',
      language: language || 'markdown',
      getValue: function() { return this.value; },
      setValue: function(newValue) { this.value = newValue; },
      getLanguageId: function() { return this.language; },
      dispose: function() {
        const index = this._models.indexOf(this);
        if (index > -1) {
          this._models.splice(index, 1);
        }
      }
    };
    
    this._models = this._models || [];
    this._models.push(model);
    return model;
  }

  /**
   * Set up VS Code themes
   */
  _setupThemes() {
    // This would normally set up Monaco themes, but for our simplified editor
    // we rely on CSS variables that VS Code provides
  }

  /**
   * Set theme (no-op for simplified editor)
   */
  _setTheme(themeName) {
    console.log('Theme set to:', themeName);
  }

  /**
   * Define theme (no-op for simplified editor)
   */
  _defineTheme(themeName, themeData) {
    console.log('Theme defined:', themeName);
  }

  /**
   * Check if key event matches keybinding
   */
  _matchesKeybinding(event, keybinding) {
    // Simple keybinding matching - this could be enhanced
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    
    // Convert Monaco keybinding to simple format
    if (typeof keybinding === 'number') {
      // This is a simplified implementation
      return false;
    }
    
    return false;
  }
}

// Export the loader
window.MonacoEditorLoader = MonacoEditorLoader;