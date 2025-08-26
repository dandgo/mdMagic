/**
 * mdMagic Editor - Main editor implementation with WYSIWYG features
 */

console.log('=== mdMagic Editor Script Loaded ===');
console.log('Document ready state:', document.readyState);
console.log('Available DOM elements:', {
  toolbar: document.getElementById('toolbar'),
  editorContainer: document.getElementById('editor-container'),
  monacoEditor: document.getElementById('monaco-editor'),
  status: document.getElementById('status')
});

class MdMagicEditor {
  constructor() {
    console.log('MdMagicEditor: Constructor called');
    this.vscode = acquireVsCodeApi();
    this.monacoLoader = new MonacoEditorLoader();
    this.editor = null;
    this.isInitialized = false;
    this.previewMode = 'off'; // 'side', 'off', 'full' - start with off, user can toggle
    this.autoSaveTimeout = null;
    this.autoSaveDelay = 1000; // 1 second
    this.isWysiwygMode = false;
    
    // State management
    this.documentState = {
      content: '',
      isDirty: false,
      cursorPosition: { line: 1, column: 1 },
      scrollPosition: 0
    };

    console.log('MdMagicEditor: Starting initialization');
    this.initializeEditor().catch(error => {
      console.error('MdMagicEditor: Failed to initialize:', error);
      this.showError('Failed to initialize editor: ' + error.message);
    });
  }

  /**
   * Initialize the editor
   */
  async initializeEditor() {
    try {
      console.log('Initializing mdMagic Editor...');
      
      // Set up DOM elements
      this.setupDOMElements();
      
      // Load Monaco Editor
      await this.monacoLoader.load();
      
      // Create editor instance
      const container = document.getElementById('monaco-editor');
      console.log('MdMagicEditor: Container found:', container);
      if (!container) {
        throw new Error('Monaco editor container not found');
      }
      
      console.log('MdMagicEditor: Creating Monaco editor...');
      this.editor = await this.monacoLoader.createEditor(container, {
        value: this.documentState.content,
        language: 'markdown',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: 'on',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        fontSize: 14,
        folding: true,
        renderWhitespace: 'selection',
        tabSize: 2,
        insertSpaces: true
      });
      
      console.log('MdMagicEditor: Editor created successfully:', this.editor);

      // Set up event listeners
      console.log('MdMagicEditor: Setting up event listeners...');
      this.setupEventListeners();
      
      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts();
      
      // Set up auto-completion
      this.setupAutoCompletion();
      
      // Enhance table editing
      this.enhanceTableEditing();
      
      // Initialize toolbar
      this.setupToolbar();
      
      // Initialize preview
      this.setupPreview();
    this.setupToolbarVisibility();
    
    // Initialize toolbar button states
    this.updateToolbarButtonStates();
      
      // Update status
      this.updateStatus();
      
      this.isInitialized = true;
      console.log('mdMagic Editor initialized successfully');
      
      // Log initial content
      console.log('MdMagicEditor: Initial editor content:', this.editor ? this.editor.getValue() : 'No editor');
      
      // Notify extension that webview is ready
      console.log('MdMagicEditor: Sending webviewReady message');
      this.vscode.postMessage({
        type: 'webviewReady',
        payload: {}
      });
      
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      console.error('Error stack:', error.stack);
      this.showError('Failed to initialize editor: ' + error.message);
      
      // Try to at least show basic functionality
      this.showBasicEditor();
    }
  }

  /**
   * Show basic editor if full initialization fails
   */
  showBasicEditor() {
    console.log('MdMagicEditor: Showing basic editor fallback');
    
    try {
      // Set up basic toolbar
      const toolbar = document.getElementById('toolbar');
      if (toolbar) {
        toolbar.innerHTML = '<div style="color: #cccccc; padding: 8px;">mdMagic Editor - Basic Mode</div>';
      }
      
      // Set up basic editor
      const container = document.getElementById('monaco-editor');
      if (container) {
        container.innerHTML = '<textarea style="width: 100%; height: 100%; background: #1e1e1e; color: #cccccc; border: none; padding: 10px; font-family: monospace;" placeholder="Start typing your markdown here..."></textarea>';
      }
      
      // Update status
      this.updateStatus('Basic Editor', 'Fallback Mode');
    } catch (error) {
      console.error('Even basic editor failed:', error);
    }
  }

  /**
   * Set up DOM elements
   */
  setupDOMElements() {
    console.log('MdMagicEditor: Setting up DOM elements');
    
    // Create the enhanced toolbar
    const toolbar = document.getElementById('toolbar');
    console.log('MdMagicEditor: Toolbar element found:', toolbar);
    
    if (!toolbar) {
      console.error('MdMagicEditor: Toolbar element not found');
      return;
    }
    
    console.log('MdMagicEditor: Creating toolbar HTML...');
    
    // Clear any existing content
    toolbar.innerHTML = '';
    
    toolbar.innerHTML = `
      <!-- Format Group -->
      <div class="toolbar-group" role="group" aria-label="Text Formatting">
        <button id="btn-bold" title="Bold (Ctrl+B)" data-command="bold" aria-label="Bold" aria-pressed="false">
          <strong>B</strong>
        </button>
        <button id="btn-italic" title="Italic (Ctrl+I)" data-command="italic" aria-label="Italic" aria-pressed="false">
          <em>I</em>
        </button>
        <button id="btn-strikethrough" title="Strikethrough" data-command="strikethrough" aria-label="Strikethrough" aria-pressed="false">
          <s>S</s>
        </button>
      </div>

      <!-- Headers Group -->
      <div class="toolbar-group">
        <select id="header-select" title="Header Level">
          <option value="">Normal Text</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
          <option value="5">H5</option>
          <option value="6">H6</option>
        </select>
      </div>

      <!-- Lists Group -->
      <div class="toolbar-group">
        <button id="btn-ul" title="Unordered List" data-command="unordered-list">
          • List
        </button>
        <button id="btn-ol" title="Ordered List" data-command="ordered-list">
          1. List
        </button>
        <button id="btn-checklist" title="Checklist" data-command="checklist">
          ☑ List
        </button>
      </div>

      <!-- Insert Group -->
      <div class="toolbar-group">
        <button id="btn-link" title="Insert Link (Ctrl+K)" data-command="link">
          🔗 Link
        </button>
        <button id="btn-image" title="Insert Image" data-command="image">
          🖼️ Image
        </button>
        <button id="btn-code" title="Code Block" data-command="code-block">
          &lt;/&gt; Code
        </button>
        <button id="btn-table" title="Insert Table" data-command="table">
          📊 Table
        </button>
      </div>

      <!-- View Group -->
      <div class="toolbar-group">
        <button id="btn-preview" title="Toggle Preview" data-command="toggle-preview">
          👁️ Preview
        </button>
        <button id="btn-wysiwyg" title="Toggle WYSIWYG" data-command="toggle-wysiwyg">
          📝 WYSIWYG
        </button>
      </div>

      <!-- Utilities Group -->
      <div class="toolbar-group">
        <button id="btn-undo" title="Undo (Ctrl+Z)" data-command="undo">
          ↶ Undo
        </button>
        <button id="btn-redo" title="Redo (Ctrl+Y)" data-command="redo">
          ↷ Redo
        </button>
        <button id="btn-find" title="Find/Replace (Ctrl+F)" data-command="find-replace">
          🔍 Find
        </button>
      </div>

      <!-- Actions Group -->
      <div class="toolbar-group">
        <button id="btn-save" title="Save (Ctrl+S)" data-command="save">
          💾 Save
        </button>
      </div>
    `;
    
    console.log('MdMagicEditor: Toolbar HTML created');

    // Create preview panel
    const editorContainer = document.getElementById('editor-container');
    console.log('MdMagicEditor: Editor container found:', editorContainer);
    
    if (!editorContainer) {
      console.error('MdMagicEditor: Editor container not found');
      return;
    }
    
    const previewPanel = document.createElement('div');
    previewPanel.id = 'preview-panel';
    previewPanel.innerHTML = '<div id="preview-content"><h3>📝 Markdown Preview</h3><p>Start typing to see your markdown rendered here...</p></div>';
    editorContainer.appendChild(previewPanel);
    
    // Add some debugging styles to make it visible during development
    previewPanel.style.border = '2px solid #007acc';
    previewPanel.style.backgroundColor = 'var(--vscode-editor-background)';
    
    console.log('MdMagicEditor: Preview panel created and added');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    console.log('MdMagicEditor: setupEventListeners called, editor:', this.editor);
    
    if (!this.editor) {
      console.error('MdMagicEditor: Editor is null in setupEventListeners');
      return;
    }
    
    // Monaco editor events
    console.log('MdMagicEditor: Setting up onDidChangeModelContent...');
    this.editor.onDidChangeModelContent(() => {
      this.documentState.content = this.editor.getValue();
      this.documentState.isDirty = true;
      this.updateStatus();
      this.updatePreview();
      this.scheduleAutoSave();
      
      // Notify extension of content change
      this.vscode.postMessage({
        type: 'contentChanged',
        payload: {
          content: this.documentState.content,
          isDirty: this.documentState.isDirty
        }
      });
    });

    this.editor.onDidChangeCursorPosition((e) => {
      this.documentState.cursorPosition = e.position;
      this.updateStatus();
      this.updateToolbarButtonStates();
    });

    // Window message handling
    window.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });

    // Toolbar events (delegated)
    const toolbar = document.getElementById('toolbar');
    console.log('MdMagicEditor: Setting up toolbar event delegation on:', toolbar);
    
    toolbar.addEventListener('click', (e) => {
      console.log('MdMagicEditor: Toolbar click event:', e.target);
      const button = e.target.closest('button');
      console.log('MdMagicEditor: Button found:', button, 'Command:', button?.dataset.command);
      
      if (button && button.dataset.command) {
        console.log('MdMagicEditor: Executing command:', button.dataset.command);
        this.executeCommand(button.dataset.command);
      }
    });

    // Header select
    document.getElementById('header-select').addEventListener('change', (e) => {
      if (e.target.value) {
        this.insertHeader(parseInt(e.target.value));
      }
      e.target.value = ''; // Reset selection
    });

    // Smart paste event listener
    const editorContainer = document.getElementById('monaco-editor');
    if (editorContainer) {
      editorContainer.addEventListener('paste', (e) => {
        this.handleSmartPaste(e);
      });

      // Drag and drop events
      editorContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        editorContainer.classList.add('drag-over');
      });

      editorContainer.addEventListener('drop', (e) => {
        editorContainer.classList.remove('drag-over');
        this.handleDragDrop(e);
      });

      // Prevent default drag behaviors on the entire container
      editorContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        editorContainer.classList.add('drag-over');
      });

      editorContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // Only remove the class if we're leaving the editor container entirely
        if (!editorContainer.contains(e.relatedTarget)) {
          editorContainer.classList.remove('drag-over');
        }
      });
    }
  }

  /**
   * Set up keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+B', command: 'bold' },
      { key: 'Ctrl+I', command: 'italic' },
      { key: 'Ctrl+K', command: 'link' },
      { key: 'Ctrl+S', command: 'save' },
      { key: 'Ctrl+Z', command: 'undo' },
      { key: 'Ctrl+Y', command: 'redo' },
      { key: 'Ctrl+F', command: 'find-replace' },
      { key: 'Ctrl+Shift+P', command: 'toggle-preview' },
      { key: 'Ctrl+Shift+W', command: 'toggle-wysiwyg' }
    ];

    shortcuts.forEach(shortcut => {
      this.editor.addAction({
        id: `mdmagic-${shortcut.command}`,
        label: shortcut.command,
        keybindings: [this.parseKeybinding(shortcut.key)],
        run: () => this.executeCommand(shortcut.command)
      });
    });
  }

  /**
   * Parse keybinding string to Monaco format
   */
  parseKeybinding(keyString) {
    // This is a simplified implementation
    // In a real Monaco integration, this would use monaco.KeyMod and monaco.KeyCode
    return keyString;
  }

  /**
   * Set up markdown auto-completion
   */
  setupAutoCompletion() {
    // Register markdown completion provider
    if (window.monaco && window.monaco.languages) {
      monaco.languages.registerCompletionItemProvider('markdown', {
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const suggestions = [];

          // Header completions
          if (textUntilPosition.match(/^#*$/)) {
            for (let i = 1; i <= 6; i++) {
              suggestions.push({
                label: '#'.repeat(i) + ' Header ' + i,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '#'.repeat(i) + ' ${1:Header}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: `Insert H${i} header`,
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: 1,
                  endColumn: position.column,
                }
              });
            }
          }

          // Bold/italic completions
          if (textUntilPosition.match(/\*$/)) {
            suggestions.push({
              label: '**bold**',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '*${1:bold text}*',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Bold text formatting',
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column - 1,
                endColumn: position.column,
              }
            });
          }

          if (textUntilPosition.match(/\*\*$/)) {
            suggestions.push({
              label: '**bold**',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '${1:bold text}**',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Bold text formatting',
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              }
            });
          }

          // Link completions
          if (textUntilPosition.match(/\[.*\]\($/)) {
            suggestions.push({
              label: 'URL link',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '${1:https://example.com})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert URL for link',
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              }
            });
          }

          // Image completions
          if (textUntilPosition.match(/!\[$/)) {
            suggestions.push({
              label: '![alt](url)',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '${1:alt text}](${2:image-url})',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert image',
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column,
              }
            });
          }

          // List completions
          if (textUntilPosition.match(/^[\s]*$/)) {
            suggestions.push(
              {
                label: '- Unordered list',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '- ${1:list item}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Insert unordered list item',
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: 1,
                  endColumn: position.column,
                }
              },
              {
                label: '1. Ordered list',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '1. ${1:list item}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Insert ordered list item',
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: 1,
                  endColumn: position.column,
                }
              },
              {
                label: '- [ ] Task list',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '- [ ] ${1:task}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Insert task list item',
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: 1,
                  endColumn: position.column,
                }
              }
            );
          }

          // Code block completions
          if (textUntilPosition.match(/```$/)) {
            const languages = ['javascript', 'typescript', 'python', 'java', 'css', 'html', 'markdown', 'json', 'bash'];
            languages.forEach(lang => {
              suggestions.push({
                label: `\`\`\`${lang}`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: `${lang}\n\${1:code}\n\`\`\``,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: `Insert ${lang} code block`,
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endColumn: position.column,
                }
              });
            });
          }

          // Table completion
          if (textUntilPosition.match(/^\|?[\s]*$/)) {
            suggestions.push({
              label: 'Table',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '| ${1:Header 1} | ${2:Header 2} | ${3:Header 3} |\n| --- | --- | --- |\n| ${4:Cell 1} | ${5:Cell 2} | ${6:Cell 3} |',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert table',
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: 1,
                endColumn: position.column,
              }
            });
          }

          return { suggestions };
        }
      });
    }
  }

  /**
   * Set up toolbar functionality
   */
  setupToolbar() {
    // All toolbar setup is handled in setupEventListeners via event delegation
  }

  /**
   * Set up toolbar visibility based on configuration
   */
  setupToolbarVisibility() {
    // Listen for configuration changes
    window.addEventListener('message', (event) => {
      if (event.data.type === 'configurationChanged' && event.data.payload.showToolbar !== undefined) {
        this.setToolbarVisibility(event.data.payload.showToolbar);
      }
    });
    
    // Initial toolbar visibility (default to true if not specified)
    this.setToolbarVisibility(true);
  }

  /**
   * Set toolbar visibility
   */
  setToolbarVisibility(visible) {
    const toolbar = document.getElementById('toolbar');
    if (toolbar) {
      toolbar.style.display = visible ? 'flex' : 'none';
      
      // Adjust editor container height when toolbar is hidden/shown
      const editorContainer = document.getElementById('editor-container');
      if (editorContainer) {
        editorContainer.style.height = visible ? 'calc(100vh - var(--toolbar-height) - var(--status-height))' : 'calc(100vh - var(--status-height))';
      }
      
      // Relayout Monaco editor
      if (this.editor) {
        this.editor.layout();
      }
    }
  }

  /**
   * Set up preview functionality
   */
  setupPreview() {
    this.updatePreview();
  }

  /**
   * Execute editor commands
   */
  executeCommand(command) {
    console.log('MdMagicEditor: executeCommand called with:', command);
    console.log('MdMagicEditor: isInitialized:', this.isInitialized, 'editor:', this.editor);
    
    if (!this.isInitialized) {
      console.log('MdMagicEditor: Editor not initialized, ignoring command');
      return;
    }

    switch (command) {
      case 'bold':
        this.toggleFormat('**', '**');
        break;
      case 'italic':
        this.toggleFormat('*', '*');
        break;
      case 'strikethrough':
        this.toggleFormat('~~', '~~');
        break;
      case 'unordered-list':
        this.insertList('-');
        break;
      case 'ordered-list':
        this.insertList('1.');
        break;
      case 'checklist':
        this.insertList('- [ ]');
        break;
      case 'link':
        this.insertLinkDialog();
        break;
      case 'image':
        this.insertImageDialog();
        break;
      case 'code-block':
        this.insertCodeBlock();
        break;
      case 'table':
        this.insertTableDialog();
        break;
      case 'toggle-preview':
        this.togglePreview();
        break;
      case 'toggle-wysiwyg':
        this.toggleWysiwyg();
        break;
      case 'save':
        this.saveDocument();
        break;
      case 'undo':
        this.editor.trigger('keyboard', 'undo', null);
        break;
      case 'redo':
        this.editor.trigger('keyboard', 'redo', null);
        break;
      case 'find-replace':
        this.editor.trigger('keyboard', 'actions.find', null);
        break;
    }
  }

  /**
   * Update toolbar button states based on current cursor position
   */
  updateToolbarButtonStates() {
    if (!this.isInitialized || !this.editor) {
      return;
    }

    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    if (!position || !model) {
      return;
    }

    // Get current line text
    const lineContent = model.getLineContent(position.lineNumber);
    const currentWord = this.getWordAtPosition(position);

    // Update button states based on current formatting
    this.updateButtonState('btn-bold', this.isTextInFormatting(currentWord, '**'));
    this.updateButtonState('btn-italic', this.isTextInFormatting(currentWord, '*') || this.isTextInFormatting(currentWord, '_'));
    this.updateButtonState('btn-strikethrough', this.isTextInFormatting(currentWord, '~~'));
    
    // Update header state
    const headerMatch = lineContent.match(/^(#{1,6})\s/);
    this.updateHeaderSelect(headerMatch ? headerMatch[1].length : 0);
    
    // Update list states
    this.updateButtonState('btn-ul', /^\s*[-*+]\s/.test(lineContent));
    this.updateButtonState('btn-ol', /^\s*\d+\.\s/.test(lineContent));
    this.updateButtonState('btn-checklist', /^\s*[-*+]\s*\[[ x]\]\s/.test(lineContent));
  }

  /**
   * Get word at current position including formatting
   */
  getWordAtPosition(position) {
    const model = this.editor.getModel();
    const lineContent = model.getLineContent(position.lineNumber);
    
    // Find word boundaries considering markdown formatting
    let startCol = position.column;
    let endCol = position.column;
    
    // Expand to include formatting characters
    while (startCol > 1 && /[\w*_~`]/.test(lineContent.charAt(startCol - 2))) {
      startCol--;
    }
    while (endCol <= lineContent.length && /[\w*_~`]/.test(lineContent.charAt(endCol - 1))) {
      endCol++;
    }
    
    return lineContent.substring(startCol - 1, endCol - 1);
  }

  /**
   * Check if text is wrapped in formatting
   */
  isTextInFormatting(text, formatting) {
    if (!text || text.length < formatting.length * 2) {
      return false;
    }
    return text.startsWith(formatting) && text.endsWith(formatting);
  }

  /**
   * Update button active state
   */
  updateButtonState(buttonId, isActive) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive.toString());
    }
  }

  /**
   * Update header select value
   */
  updateHeaderSelect(headerLevel) {
    const select = document.getElementById('header-select');
    if (select) {
      select.value = headerLevel > 0 ? headerLevel.toString() : '';
    }
  }

  /**
   * Toggle text formatting
   */
  toggleFormat(before, after) {
    const selection = this.editor.getSelection();
    const model = this.editor.getModel();
    const selectedText = model.getValueInRange(selection);
    
    let newText;
    if (selectedText.startsWith(before) && selectedText.endsWith(after)) {
      // Remove formatting
      newText = selectedText.slice(before.length, -after.length);
    } else {
      // Add formatting
      newText = before + selectedText + after;
    }
    
    this.editor.executeEdits('mdmagic', [{
      range: selection,
      text: newText
    }]);
    
    // Restore selection
    const newSelection = new monaco.Selection(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.startColumn + newText.length
    );
    this.editor.setSelection(newSelection);
    this.editor.focus();
  }

  /**
   * Insert header
   */
  insertHeader(level) {
    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const line = model.getLineContent(position.lineNumber);
    
    // Remove existing header markers
    const cleanLine = line.replace(/^#+\s*/, '');
    const headerPrefix = '#'.repeat(level) + ' ';
    
    this.editor.executeEdits('mdmagic', [{
      range: new monaco.Range(position.lineNumber, 1, position.lineNumber, line.length + 1),
      text: headerPrefix + cleanLine
    }]);
    
    this.editor.focus();
  }

  /**
   * Insert list
   */
  insertList(marker) {
    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const line = model.getLineContent(position.lineNumber);
    
    if (line.trim() === '') {
      // Insert list marker at beginning of empty line
      this.editor.executeEdits('mdmagic', [{
        range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
        text: marker + ' '
      }]);
    } else {
      // Insert new line with list marker
      this.editor.executeEdits('mdmagic', [{
        range: new monaco.Range(position.lineNumber, line.length + 1, position.lineNumber, line.length + 1),
        text: '\n' + marker + ' '
      }]);
    }
    
    this.editor.focus();
  }

  /**
   * Insert link dialog
   */
  insertLinkDialog() {
    const selection = this.editor.getSelection();
    const selectedText = this.editor.getModel().getValueInRange(selection);
    
    this.showDialog('Insert Link', `
      <label for="link-text">Link Text:</label>
      <input type="text" id="link-text" value="${selectedText}" placeholder="Link text">
      
      <label for="link-url">URL:</label>
      <input type="text" id="link-url" placeholder="https://example.com">
    `, (dialog) => {
      const text = dialog.querySelector('#link-text').value;
      const url = dialog.querySelector('#link-url').value;
      
      if (text && url) {
        const linkText = `[${text}](${url})`;
        this.editor.executeEdits('mdmagic', [{
          range: selection,
          text: linkText
        }]);
        this.editor.focus();
      }
    });
  }

  /**
   * Insert image dialog
   */
  insertImageDialog() {
    this.showDialog('Insert Image', `
      <label for="image-alt">Alt Text:</label>
      <input type="text" id="image-alt" placeholder="Image description">
      
      <label for="image-url">Image URL:</label>
      <input type="text" id="image-url" placeholder="https://example.com/image.jpg">
      
      <label for="image-title">Title (optional):</label>
      <input type="text" id="image-title" placeholder="Image title">
    `, (dialog) => {
      const alt = dialog.querySelector('#image-alt').value;
      const url = dialog.querySelector('#image-url').value;
      const title = dialog.querySelector('#image-title').value;
      
      if (alt && url) {
        const imageText = title 
          ? `![${alt}](${url} "${title}")` 
          : `![${alt}](${url})`;
        
        const position = this.editor.getPosition();
        this.editor.executeEdits('mdmagic', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: imageText
        }]);
        this.editor.focus();
      }
    });
  }

  /**
   * Insert code block
   */
  insertCodeBlock() {
    const position = this.editor.getPosition();
    const codeBlock = '```\n\n```\n';
    
    this.editor.executeEdits('mdmagic', [{
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: codeBlock
    }]);
    
    // Position cursor inside the code block
    this.editor.setPosition({
      lineNumber: position.lineNumber + 1,
      column: 1
    });
    this.editor.focus();
  }

  /**
   * Insert table dialog
   */
  insertTableDialog() {
    this.showDialog('Insert Table', `
      <label for="table-rows">Rows:</label>
      <input type="number" id="table-rows" value="3" min="1" max="20">
      
      <label for="table-cols">Columns:</label>
      <input type="number" id="table-cols" value="3" min="1" max="10">
      
      <label for="table-headers">Include Headers:</label>
      <input type="checkbox" id="table-headers" checked>
    `, (dialog) => {
      const rows = parseInt(dialog.querySelector('#table-rows').value);
      const cols = parseInt(dialog.querySelector('#table-cols').value);
      const hasHeaders = dialog.querySelector('#table-headers').checked;
      
      if (rows > 0 && cols > 0) {
        const table = this.generateTable(rows, cols, hasHeaders);
        const position = this.editor.getPosition();
        
        this.editor.executeEdits('mdmagic', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: table
        }]);
        this.editor.focus();
      }
    });
  }

  /**
   * Generate table markdown
   */
  generateTable(rows, cols, hasHeaders) {
    let table = '';
    
    // Header row
    if (hasHeaders) {
      table += '| ' + Array(cols).fill('Header').map((h, i) => h + ' ' + (i + 1)).join(' | ') + ' |\n';
      table += '| ' + Array(cols).fill('---').join(' | ') + ' |\n';
      rows--; // One less data row since we have a header
    }
    
    // Data rows
    for (let r = 0; r < rows; r++) {
      table += '| ' + Array(cols).fill('Cell').map((c, i) => c + ' ' + (r + 1) + ',' + (i + 1)).join(' | ') + ' |\n';
    }
    
    return table + '\n';
  }

  /**
   * Enhanced table navigation and editing
   */
  enhanceTableEditing() {
    if (!this.editor) {return;}

    // Add table navigation shortcuts
    this.editor.addAction({
      id: 'table-navigate-next',
      label: 'Navigate to Next Table Cell',
      keybindings: [9], // Tab key
      contextMenuGroupId: 'navigation',
      run: (editor) => {
        if (this.isInTable()) {
          this.navigateTableCell('next');
          return true;
        }
        return false;
      }
    });

    this.editor.addAction({
      id: 'table-navigate-prev',
      label: 'Navigate to Previous Table Cell',
      keybindings: [2073], // Shift+Tab
      contextMenuGroupId: 'navigation',
      run: (editor) => {
        if (this.isInTable()) {
          this.navigateTableCell('prev');
          return true;
        }
        return false;
      }
    });

    this.editor.addAction({
      id: 'table-add-row',
      label: 'Add Table Row',
      keybindings: [2080], // Ctrl+Shift+Enter
      contextMenuGroupId: 'table',
      run: (editor) => {
        if (this.isInTable()) {
          this.addTableRow();
          return true;
        }
        return false;
      }
    });
  }

  /**
   * Check if cursor is in a table
   */
  isInTable() {
    if (!this.editor) {return false;}

    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const lineContent = model.getLineContent(position.lineNumber);
    
    return lineContent.includes('|');
  }

  /**
   * Navigate table cells
   */
  navigateTableCell(direction) {
    if (!this.editor) {return;}

    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const lineContent = model.getLineContent(position.lineNumber);
    
    const cells = lineContent.split('|').map(cell => cell.trim());
    const currentColumn = position.column;
    
    // Find current cell index
    let cellStart = 0;
    let currentCellIndex = 0;
    
    for (let i = 0; i < cells.length; i++) {
      const cellEnd = cellStart + cells[i].length + 1; // +1 for the |
      if (currentColumn >= cellStart && currentColumn <= cellEnd) {
        currentCellIndex = i;
        break;
      }
      cellStart = cellEnd;
    }
    
    if (direction === 'next') {
      // Move to next cell or next row
      if (currentCellIndex < cells.length - 1) {
        const nextCellStart = cellStart + cells[currentCellIndex].length + 2; // +2 for | and space
        this.editor.setPosition({ lineNumber: position.lineNumber, column: nextCellStart });
      } else {
        // Move to first cell of next row
        const nextLine = position.lineNumber + 1;
        if (nextLine <= model.getLineCount()) {
          const nextLineContent = model.getLineContent(nextLine);
          if (nextLineContent.includes('|')) {
            this.editor.setPosition({ lineNumber: nextLine, column: 2 }); // After first |
          }
        }
      }
    } else if (direction === 'prev') {
      // Move to previous cell or previous row
      if (currentCellIndex > 0) {
        const prevCellEnd = cellStart - 1;
        this.editor.setPosition({ lineNumber: position.lineNumber, column: prevCellEnd });
      } else {
        // Move to last cell of previous row
        const prevLine = position.lineNumber - 1;
        if (prevLine >= 1) {
          const prevLineContent = model.getLineContent(prevLine);
          if (prevLineContent.includes('|')) {
            const prevCells = prevLineContent.split('|');
            const lastCellStart = prevLineContent.lastIndexOf('|', prevLineContent.length - 2);
            this.editor.setPosition({ lineNumber: prevLine, column: lastCellStart - 1 });
          }
        }
      }
    }
  }

  /**
   * Add a new row to the table
   */
  addTableRow() {
    if (!this.editor) {return;}

    const position = this.editor.getPosition();
    const model = this.editor.getModel();
    const lineContent = model.getLineContent(position.lineNumber);
    
    // Count columns in current row
    const cells = lineContent.split('|').filter(cell => cell.trim().length > 0);
    const numCols = cells.length;
    
    // Generate new row
    const newRow = '| ' + Array(numCols).fill('Cell').join(' | ') + ' |';
    
    // Insert new row after current line
    this.editor.executeEdits('add-table-row', [{
      range: new monaco.Range(position.lineNumber, lineContent.length + 1, position.lineNumber, lineContent.length + 1),
      text: '\n' + newRow
    }]);
    
    // Move cursor to first cell of new row
    this.editor.setPosition({ lineNumber: position.lineNumber + 1, column: 3 });
  }

  /**
   * Toggle preview panel
   */
  togglePreview() {
    console.log('MdMagicEditor: togglePreview called, current mode:', this.previewMode);
    
    const previewPanel = document.getElementById('preview-panel');
    const editorContainer = document.getElementById('editor-container');
    const monacoContainer = document.getElementById('monaco-editor');
    
    console.log('MdMagicEditor: Preview elements found:');
    console.log('  - previewPanel:', previewPanel);
    console.log('  - editorContainer:', editorContainer);
    console.log('  - monacoContainer:', monacoContainer);
    
    if (this.previewMode === 'off') {
      // Show side preview
      this.previewMode = 'side';
      console.log('MdMagicEditor: Adding visible class to preview panel');
      previewPanel.classList.add('visible');
      monacoContainer.style.width = '50%';
      console.log('MdMagicEditor: Preview panel classes:', previewPanel.classList.toString());
      console.log('MdMagicEditor: Monaco container width set to 50%');
    } else if (this.previewMode === 'side') {
      // Show full preview
      this.previewMode = 'full';
      monacoContainer.style.width = '0%';
      monacoContainer.style.display = 'none';
    } else {
      // Hide preview
      this.previewMode = 'off';
      previewPanel.classList.remove('visible');
      monacoContainer.style.width = '100%';
      monacoContainer.style.display = 'block';
    }
    
    // Update button state
    const btn = document.getElementById('btn-preview');
    btn.classList.toggle('active', this.previewMode !== 'off');
    
    this.editor.layout();
    this.updatePreview();
  }

  /**
   * Toggle WYSIWYG mode
   */
  toggleWysiwyg() {
    console.log('MdMagicEditor: toggleWysiwyg called, current mode:', this.isWysiwygMode);
    this.isWysiwygMode = !this.isWysiwygMode;
    console.log('MdMagicEditor: WYSIWYG mode is now:', this.isWysiwygMode);
    
    // Update button state
    const btn = document.getElementById('btn-wysiwyg');
    console.log('MdMagicEditor: WYSIWYG button found:', btn);
    if (btn) {
      btn.classList.toggle('active', this.isWysiwygMode);
      console.log('MdMagicEditor: Button classes after toggle:', btn.classList.toString());
    }
    
    if (this.isWysiwygMode) {
      // Enable enhanced WYSIWYG mode
      this.enableWysiwygFeatures();
      
      // Show preview if not already visible
      if (this.previewMode === 'off') {
        this.togglePreview();
      }
    } else {
      // Disable enhanced WYSIWYG mode
      this.disableWysiwygFeatures();
    }
    
    this.updatePreview();
  }

  /**
   * Enable enhanced WYSIWYG features
   */
  enableWysiwygFeatures() {
    // Add WYSIWYG styling to editor container
    const editorContainer = document.getElementById('monaco-editor');
    if (editorContainer) {
      editorContainer.classList.add('wysiwyg-mode');
    }

    // Enable real-time preview updates with shorter delay
    this._originalUpdateDelay = this.autoSaveDelay;
    this.autoSaveDelay = 100; // Faster updates for WYSIWYG

    // Add enhanced cursor position tracking for live preview
    if (this.editor && this.editor.onDidChangeCursorPosition) {
      this._wysiwygCursorHandler = this.editor.onDidChangeCursorPosition(() => {
        // Sync scroll position between editor and preview
        this.syncScrollPosition();
      });
    }

    // Enhanced formatting button state updates
    if (this.editor && this.editor.onDidChangeModelContent) {
      this._wysiwygContentHandler = this.editor.onDidChangeModelContent(() => {
        // Update preview with animation
        this.updatePreviewWithAnimation();
        
        // Update toolbar button states more frequently
        this.updateToolbarButtonStates();
      });
    }
  }

  /**
   * Disable enhanced WYSIWYG features
   */
  disableWysiwygFeatures() {
    // Remove WYSIWYG styling
    const editorContainer = document.getElementById('monaco-editor');
    if (editorContainer) {
      editorContainer.classList.remove('wysiwyg-mode');
    }

    // Restore original update delay
    if (this._originalUpdateDelay) {
      this.autoSaveDelay = this._originalUpdateDelay;
    }

    // Dispose enhanced event handlers
    if (this._wysiwygCursorHandler) {
      this._wysiwygCursorHandler.dispose();
      this._wysiwygCursorHandler = null;
    }

    if (this._wysiwygContentHandler) {
      this._wysiwygContentHandler.dispose();
      this._wysiwygContentHandler = null;
    }
  }

  /**
   * Sync scroll position between editor and preview
   */
  syncScrollPosition() {
    if (!this.isWysiwygMode || this.previewMode === 'off') {
      return;
    }

    const previewPanel = document.getElementById('preview-panel');
    if (!previewPanel || !this.editor) {
      return;
    }

    try {
      // Get current editor scroll position
      const editorScrollTop = this.editor.getScrollTop();
      const editorScrollHeight = this.editor.getScrollHeight();
      const editorViewHeight = this.editor.getLayoutInfo().height;

      // Calculate scroll ratio
      const scrollRatio = editorScrollTop / (editorScrollHeight - editorViewHeight);

      // Apply to preview panel
      const previewScrollHeight = previewPanel.scrollHeight - previewPanel.clientHeight;
      previewPanel.scrollTop = scrollRatio * previewScrollHeight;
    } catch (error) {
      console.warn('Error syncing scroll position:', error);
    }
  }

  /**
   * Update preview with animation
   */
  updatePreviewWithAnimation() {
    if (this.previewMode === 'off') {
      return;
    }

    const previewContent = document.getElementById('preview-content');
    if (!previewContent) {
      return;
    }

    // Add fade effect for smooth updates
    previewContent.style.transition = 'opacity 0.1s ease-in-out';
    previewContent.style.opacity = '0.8';

    // Update content
    const content = this.editor.getValue();
    try {
      const html = this.markdownToHtml(content);
      previewContent.innerHTML = html;
    } catch (error) {
      console.error('Error updating preview:', error);
      previewContent.innerHTML = '<p>Error rendering preview</p>';
    }

    // Restore opacity
    setTimeout(() => {
      previewContent.style.opacity = '1';
    }, 50);
  }

  /**
   * Update preview content
   */
  updatePreview() {
    console.log('MdMagicEditor: updatePreview called, previewMode:', this.previewMode);
    
    if (this.previewMode === 'off') {
      console.log('MdMagicEditor: Preview mode is off, skipping update');
      return;
    }
    
    const content = this.editor.getValue();
    const previewContent = document.getElementById('preview-content');
    console.log('MdMagicEditor: Updating preview with content length:', content?.length || 0);
    console.log('MdMagicEditor: Preview content element:', previewContent);
    
    try {
      // Simple markdown-to-HTML conversion
      const html = this.markdownToHtml(content);
      console.log('MdMagicEditor: Generated HTML length:', html.length);
      previewContent.innerHTML = html;
      console.log('MdMagicEditor: Preview content updated successfully');
    } catch (error) {
      console.error('Preview update error:', error);
      previewContent.innerHTML = '<p style="color: var(--vscode-errorForeground);">Preview Error: ' + error.message + '</p>';
    }
  }

  /**
   * Simple markdown to HTML converter
   */
  markdownToHtml(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Code blocks (must be before inline code)
    html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre><code class="language-$1" style="background: #2d2d30; color: #ce9178;">$2</code></pre>');
    
    // Headers
    html = html.replace(/^#### (.*$)/gim, '<h4 style="color: #4fc1ff; margin: 24px 0 12px 0;">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 style="color: #4fc1ff; margin: 24px 0 12px 0;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="color: #4fc1ff; margin: 24px 0 12px 0; font-size: 1.5em;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="color: #4fc1ff; margin: 24px 0 12px 0; font-size: 2em; border-bottom: 1px solid #3e3e42; padding-bottom: 8px;">$1</h1>');
    
    // Bold and Italic (order matters)
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background: #2d2d30; padding: 2px 6px; border-radius: 3px; color: #ce9178; font-family: \'Courier New\', monospace;">$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #4fc1ff; text-decoration: underline;">$1</a>');
    
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;">');
    
    // Lists - Unordered (including - and *)
    html = html.replace(/^\s*[-*] (.+)/gm, '<li style="margin: 4px 0;">$1</li>');
    html = html.replace(/(<li.*<\/li>)/gs, '<ul style="margin: 12px 0; padding-left: 24px;">$1</ul>');
    
    // Lists - Ordered
    html = html.replace(/^\s*\d+\. (.+)/gm, '<li style="margin: 4px 0;">$1</li>');
    html = html.replace(/(<li.*<\/li>)/gs, function(match) {
      return match.includes('</ul>') ? match : '<ol style="margin: 12px 0; padding-left: 24px;">' + match + '</ol>';
    });
    
    // Blockquotes
    html = html.replace(/^> (.+)/gm, '<blockquote style="border-left: 4px solid #007acc; margin: 16px 0; padding: 8px 16px; color: #cccccc; background: rgba(0, 122, 204, 0.1); border-radius: 0 4px 4px 0;">$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #3e3e42; margin: 24px 0;">');
    
    // Paragraphs
    html = html.replace(/\n\s*\n/g, '</p><p style="margin: 12px 0; line-height: 1.6;">');
    html = '<p style="margin: 12px 0; line-height: 1.6;">' + html + '</p>';
    
    // Clean up empty paragraphs and fix nested tags
    html = html.replace(/<p[^>]*><\/p>/g, '');
    html = html.replace(/<p[^>]*>(<h[1-6][^>]*>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p[^>]*>(<[uo]l[^>]*>)/g, '$1');
    html = html.replace(/(<\/[uo]l>)<\/p>/g, '$1');
    html = html.replace(/<p[^>]*>(<pre[^>]*>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p[^>]*>(<blockquote[^>]*>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p[^>]*>(<hr[^>]*>)/g, '$1');
    html = html.replace(/(<hr[^>]*>)<\/p>/g, '$1');
    
    // Clean up consecutive lists
    html = html.replace(/<\/ul>\s*<ul[^>]*>/g, '');
    html = html.replace(/<\/ol>\s*<ol[^>]*>/g, '');
    
    return html;
  }

  /**
   * Schedule auto-save
   */
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      if (this.documentState.isDirty) {
        this.autoSave();
      }
    }, this.autoSaveDelay);
  }

  /**
   * Auto-save document
   */
  autoSave() {
    this.vscode.postMessage({
      type: 'contentChanged',
      payload: {
        content: this.documentState.content,
        isDirty: this.documentState.isDirty,
        autoSave: true
      }
    });
  }

  /**
   * Save document
   */
  saveDocument() {
    this.vscode.postMessage({
      type: 'saveDocument',
      payload: {
        content: this.documentState.content
      }
    });
    
    this.documentState.isDirty = false;
    this.updateStatus();
  }

  /**
   * Update status bar
   */
  updateStatus(leftText = null, rightText = null) {
    const status = document.getElementById('status');
    
    if (leftText && rightText) {
      // Fallback mode - use provided text
      status.innerHTML = `
        <div class="status-left">${leftText}</div>
        <div class="status-right">${rightText}</div>
      `;
      return;
    }
    
    // Normal mode - calculate from editor state
    const content = this.editor ? this.editor.getValue() : '';
    const lines = content.split('\n').length;
    const chars = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    
    const position = this.documentState.cursorPosition;
    const dirtyIndicator = this.documentState.isDirty ? ' •' : '';
    const modeIndicator = this.isWysiwygMode ? 'WYSIWYG' : 'Editor';
    
    const leftStatus = `Ln ${position.lineNumber}, Col ${position.column} | ${lines} lines | ${words} words | ${chars} chars`;
    const rightStatus = `${modeIndicator}${dirtyIndicator}`;
    
    status.innerHTML = `
      <div class="status-left">${leftStatus}</div>
      <div class="status-right">${rightStatus}</div>
    `;
  }

  /**
   * Handle messages from extension
   */
  handleMessage(message) {
    console.log('MdMagicEditor: Received message:', message);
    console.log('MdMagicEditor: Current editor state:', {
      isInitialized: this.isInitialized,
      hasEditor: !!this.editor,
      currentContent: this.editor ? this.editor.getValue() : 'No editor'
    });
    
    switch (message.type) {
      case 'setContent':
        console.log('MdMagicEditor: Processing setContent message');
        console.log('MdMagicEditor: New content length:', message.payload?.content?.length || 0);
        console.log('MdMagicEditor: From file:', message.payload?.fromFile || false);
        
        if (this.editor) {
          const newContent = message.payload.content;
          const fromFile = message.payload.fromFile || false;
          
          console.log('MdMagicEditor: Current content vs new content:', {
            currentLength: this.editor.getValue().length,
            newLength: newContent?.length || 0,
            different: this.editor.getValue() !== newContent
          });
          
          // Only update if content is different to avoid cursor jumps
          if (this.editor.getValue() !== newContent) {
            // Store cursor position
            const position = this.editor.getPosition();
            const scrollTop = this.editor.getScrollTop();
            
            // Update content
            this.editor.setValue(newContent);
            this.documentState.content = newContent;
            
            if (fromFile) {
              // Content came from file, mark as clean
              this.documentState.isDirty = false;
              console.log('MdMagicEditor: Content updated from file, marking as clean');
            } else {
              // Content came from webview command, preserve dirty state
              console.log('MdMagicEditor: Content set via command');
            }
            
            // Try to restore cursor position (may not be exact if content length changed significantly)
            try {
              this.editor.setPosition(position);
              this.editor.setScrollTop(scrollTop);
            } catch (error) {
              console.warn('MdMagicEditor: Could not restore cursor position:', error);
            }
            
            this.updateStatus();
            this.updatePreview();
            
            if (fromFile) {
              // Show brief indication that file was updated
              this.showFileUpdateNotification();
            }
          } else {
            console.log('MdMagicEditor: Content is the same, skipping update');
          }
        } else {
          console.log('MdMagicEditor: Editor not ready, storing content for later');
          // Store content in document state for when editor becomes available
          this.documentState.content = message.payload.content || '';
        }
        break;
        
      case 'contentChanged':
        // Handle content change notifications from extension
        if (message.payload.saved) {
          this.documentState.isDirty = false;
          this.updateStatus();
          console.log('MdMagicEditor: Document saved, marked as clean');
        }
        break;
        
      case 'updateConfig':
        // Handle configuration updates
        if (message.payload.autoSave !== undefined) {
          this.autoSaveDelay = message.payload.autoSave ? 1000 : 0;
        }
        if (message.payload.showToolbar !== undefined) {
          this.setToolbarVisibility(message.payload.showToolbar);
        }
        break;
        
      case 'executeCommand':
        this.executeCommand(message.payload.command);
        break;
    }
  }

  /**
   * Show dialog
   */
  showDialog(title, content, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay fade-in';
    
    overlay.innerHTML = `
      <div class="dialog slide-down">
        <h3>${title}</h3>
        ${content}
        <div class="dialog-buttons">
          <button class="secondary" onclick="this.closest('.dialog-overlay').remove()">Cancel</button>
          <button class="primary" id="dialog-confirm">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus first input
    const firstInput = overlay.querySelector('input, textarea');
    if (firstInput) {
      firstInput.focus();
    }
    
    // Handle confirm
    overlay.querySelector('#dialog-confirm').onclick = () => {
      onConfirm(overlay.querySelector('.dialog'));
      overlay.remove();
    };
    
    // Handle ESC key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    
    // Handle overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Convert HTML to Markdown (Smart Paste functionality)
   */
  convertHTMLToMarkdown(html) {
    // Remove extra whitespace and normalize
    html = html.trim().replace(/\s+/g, ' ');
    
    // Convert common HTML elements to markdown
    let markdown = html;
    
    // Headers (h1-h6)
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    
    // Bold and italic
    markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
    markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
    
    // Links
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Images
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)');
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');
    
    // Code blocks and inline code
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    
    // Lists
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      const items = content.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
      return items + '\n';
    });
    
    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      let counter = 1;
      const items = content.replace(/<li[^>]*>(.*?)<\/li>/gis, () => {
        return `${counter++}. $1\n`;
      });
      return items + '\n';
    });
    
    // Blockquotes
    markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n');
    
    // Paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // Line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");
    markdown = markdown.replace(/&nbsp;/g, ' ');
    
    // Clean up extra newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();
    
    return markdown;
  }

  /**
   * Handle smart paste functionality
   */
  handleSmartPaste(event) {
    const clipboardData = event.clipboardData || window.clipboardData;
    
    if (!clipboardData) {
      return false; // Let default paste behavior happen
    }
    
    // Check if there's HTML content
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');
    
    if (htmlData && htmlData.trim()) {
      // Convert HTML to markdown
      const markdown = this.convertHTMLToMarkdown(htmlData);
      
      // Only use converted markdown if it's meaningfully different from plain text
      if (markdown && markdown !== textData && markdown.length > 0) {
        event.preventDefault();
        
        // Insert the converted markdown
        const position = this.editor.getPosition();
        this.editor.executeEdits('smart-paste', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: markdown
        }]);
        
        // Update cursor position
        const lines = markdown.split('\n');
        const newLineNumber = position.lineNumber + lines.length - 1;
        const newColumn = lines.length === 1 ? position.column + markdown.length : lines[lines.length - 1].length + 1;
        
        this.editor.setPosition({ lineNumber: newLineNumber, column: newColumn });
        this.editor.focus();
        
        return true; // Indicate that we handled the paste
      }
    }
    
    return false; // Let default paste behavior happen
  }

  /**
   * Handle drag and drop for images
   */
  handleDragDrop(event) {
    event.preventDefault();
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        this.insertImageFile(file, event);
      }
    }
  }

  /**
   * Insert image file into editor
   */
  async insertImageFile(file, event) {
    try {
      // Create a data URL for the image
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const fileName = file.name;
        
        // Create markdown image syntax
        const imageMarkdown = `![${fileName}](${dataUrl})`;
        
        // Get cursor position from drop event or use current position
        let position = this.editor.getPosition();
        
        if (event && event.clientX && event.clientY) {
          // Try to get position from mouse coordinates
          const editorPosition = this.editor.getPositionAt(event.clientX, event.clientY);
          if (editorPosition) {
            position = editorPosition;
          }
        }
        
        // Insert the image
        this.editor.executeEdits('image-drop', [{
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: imageMarkdown
        }]);
        
        // Update cursor position
        const newColumn = position.column + imageMarkdown.length;
        this.editor.setPosition({ lineNumber: position.lineNumber, column: newColumn });
        this.editor.focus();
        
        // Update preview if active
        this.updatePreview();
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error inserting image:', error);
      this.showError('Failed to insert image: ' + error.message);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error(message);
    // Could show a toast notification here
  }

  /**
   * Show brief notification that file was updated from disk
   */
  showFileUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: var(--vscode-notifications-background, #007acc);
      color: var(--vscode-notifications-foreground, white);
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    `;
    notification.textContent = '📄 File updated from disk';
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 200);
    }, 2000);
  }
}

// Make sure the class is globally available
console.log('MdMagicEditor class defined:', typeof MdMagicEditor);
window.MdMagicEditor = MdMagicEditor;

// Initialize editor when DOM is ready
console.log('MdMagicEditor: Script loaded, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
  console.log('MdMagicEditor: Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('MdMagicEditor: DOMContentLoaded event fired, creating editor');
    window.mdMagicEditorInitialized = true;  // Prevent fallback
    new MdMagicEditor();
  });
} else {
  console.log('MdMagicEditor: Document already loaded, creating editor immediately');
  window.mdMagicEditorInitialized = true;  // Prevent fallback
  new MdMagicEditor();
}