/**
 * Enhanced Markdown Viewer Script
 * Provides advanced markdown rendering with syntax highlighting, themes, and TOC
 */

class MarkdownViewer {
  constructor() {
    this.vscode = acquireVsCodeApi();
    this.contentDiv = document.getElementById('content');
    this.tocContainer = document.getElementById('toc-container');
    this.currentTheme = 'default';
    
    this.initializeViewer();
    this.setupEventListeners();
  }

  /**
   * Initialize the viewer with enhanced features
   */
  initializeViewer() {
    // Load highlight.js styles dynamically
    this.loadHighlightStyles();
    
    // Initialize marked with custom renderer
    this.setupMarkedRenderer();
    
    console.log('[MarkdownViewer] Initialized successfully');
  }

  /**
   * Setup marked.js renderer with highlight.js integration
   */
  setupMarkedRenderer() {
    // Configure marked options
    this.markedOptions = {
      highlight: (code, language) => {
        return this.highlightCode(code, language);
      },
      breaks: true,
      gfm: true,
      sanitize: false, // We trust the markdown content from VS Code
      smartLists: true,
      smartypants: true
    };
  }

  /**
   * Enhanced markdown to HTML conversion using marked.js
   */
  markdownToHtml(markdown) {
    if (!markdown) {
      return '<p>No content to display</p>';
    }

    try {
      // Use a simplified marked-like implementation since we can't import ES modules
      return this.parseMarkdownAdvanced(markdown);
    } catch (error) {
      console.error('[MarkdownViewer] Error rendering markdown:', error);
      return `<div class="error">Error rendering markdown: ${error.message}</div>`;
    }
  }

  /**
   * Advanced markdown parser with enhanced features
   */
  parseMarkdownAdvanced(markdown) {
    let html = markdown;
    
    // Store code blocks temporarily to avoid processing them
    const codeBlocks = [];
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const index = codeBlocks.length;
      codeBlocks.push({
        language: language || '',
        code: code.trim()
      });
      return `__CODE_BLOCK_${index}__`;
    });

    // Headers (collect for TOC)
    const headers = [];
    html = html.replace(/^(#{1,6})\s+(.*$)/gim, (match, hashes, title) => {
      const level = hashes.length;
      const id = this.generateHeaderId(title);
      headers.push({ level, title, id });
      console.log('[MarkdownViewer] Found header:', { level, title, id });
      return `<h${level} id="${id}">${title}</h${level}>`;
    });

    // Store headers for TOC generation
    this.currentHeaders = headers;
    console.log('[MarkdownViewer] All headers collected:', this.currentHeaders);

    // Bold and Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Tables
    html = this.parseTables(html);

    // Lists
    html = this.parseLists(html);

    // Blockquotes
    html = html.replace(/^>\s+(.*$)/gim, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr>');

    // Paragraphs
    html = html.replace(/\n\s*\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs if not already wrapped
    if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<pre') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<blockquote')) {
      html = '<p>' + html + '</p>';
    }

    // Restore code blocks with syntax highlighting
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
      const block = codeBlocks[parseInt(index)];
      const highlightedCode = this.highlightCode(block.code, block.language);
      return `<pre><code class="hljs language-${block.language}">${highlightedCode}</code></pre>`;
    });

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>|<ol>|<pre>|<blockquote>|<hr>)/g, '$1');
    html = html.replace(/(<\/ul>|<\/ol>|<\/pre>|<\/blockquote>|<hr>)<\/p>/g, '$1');

    return html;
  }

  /**
   * Parse tables in markdown
   */
  parseTables(html) {
    const tableRegex = /(\|[^\n]+\|\n)(\|[\s:-]+\|\n)((?:\|[^\n]+\|\n?)*)/g;
    return html.replace(tableRegex, (match, header, separator, rows) => {
      // Parse header
      const headerCells = header.trim().slice(1, -1).split('|').map(cell => 
        `<th>${cell.trim()}</th>`
      ).join('');

      // Parse rows
      const rowsHtml = rows.trim().split('\n').filter(row => row.trim()).map(row => {
        const cells = row.trim().slice(1, -1).split('|').map(cell => 
          `<td>${cell.trim()}</td>`
        ).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    });
  }

  /**
   * Parse lists in markdown
   */
  parseLists(html) {
    // Unordered lists
    html = html.replace(/^[\s]*[\*\-\+]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists  
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, (match) => {
      // Only wrap if not already in a ul
      if (match.includes('<ul>')) {
        return match;
      }
      return `<ol>${match}</ol>`;
    });

    return html;
  }

  /**
   * Highlight code using a simple highlighter
   */
  highlightCode(code, language) {
    if (!code) {
      return '';
    }

    // Simple syntax highlighting for common languages
    const highlighters = {
      javascript: this.highlightJavaScript.bind(this),
      js: this.highlightJavaScript.bind(this),
      typescript: this.highlightTypeScript.bind(this),
      ts: this.highlightTypeScript.bind(this),
      html: this.highlightHTML.bind(this),
      css: this.highlightCSS.bind(this),
      json: this.highlightJSON.bind(this),
      markdown: this.highlightMarkdown.bind(this),
      md: this.highlightMarkdown.bind(this)
    };

    const highlighter = highlighters[language.toLowerCase()];
    if (highlighter) {
      return highlighter(code);
    }

    // Default highlighting for unknown languages
    return this.escapeHtml(code);
  }

  /**
   * JavaScript syntax highlighting
   */
  highlightJavaScript(code) {
    return this.escapeHtml(code)
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|default)\b/g, '<span class="hljs-keyword">$1</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="hljs-literal">$1</span>')
      .replace(/"([^"]*)"/g, '<span class="hljs-string">"$1"</span>')
      .replace(/'([^']*)'/g, '<span class="hljs-string">\'$1\'</span>')
      .replace(/\/\/.*$/gm, '<span class="hljs-comment">$&</span>')
      .replace(/\/\*[\s\S]*?\*\//g, '<span class="hljs-comment">$&</span>');
  }

  /**
   * TypeScript syntax highlighting
   */
  highlightTypeScript(code) {
    return this.highlightJavaScript(code)
      .replace(/\b(interface|type|enum|implements|public|private|protected|readonly)\b/g, '<span class="hljs-keyword">$1</span>');
  }

  /**
   * HTML syntax highlighting
   */
  highlightHTML(code) {
    return this.escapeHtml(code)
      .replace(/&lt;(\/?[\w\-]+)(.*?)&gt;/g, '<span class="hljs-tag">&lt;<span class="hljs-name">$1</span>$2&gt;</span>')
      .replace(/(\w+)=/g, '<span class="hljs-attr">$1</span>=')
      .replace(/"([^"]*)"/g, '<span class="hljs-string">"$1"</span>');
  }

  /**
   * CSS syntax highlighting
   */
  highlightCSS(code) {
    return this.escapeHtml(code)
      .replace(/([.#]?[\w\-]+)\s*{/g, '<span class="hljs-selector">$1</span> {')
      .replace(/([\w\-]+):/g, '<span class="hljs-property">$1</span>:')
      .replace(/:\s*([^;]+);/g, ': <span class="hljs-value">$1</span>;');
  }

  /**
   * JSON syntax highlighting
   */
  highlightJSON(code) {
    return this.escapeHtml(code)
      .replace(/"([\w\-]+)":/g, '<span class="hljs-attr">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="hljs-string">"$1"</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="hljs-literal">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span class="hljs-number">$1</span>');
  }

  /**
   * Markdown syntax highlighting
   */
  highlightMarkdown(code) {
    return this.escapeHtml(code)
      .replace(/^(#{1,6})\s+(.*)$/gm, '<span class="hljs-section">$1 $2</span>')
      .replace(/\*\*(.*?)\*\*/g, '<span class="hljs-strong">**$1**</span>')
      .replace(/\*(.*?)\*/g, '<span class="hljs-emphasis">*$1*</span>')
      .replace(/`([^`]+)`/g, '<span class="hljs-code">`$1`</span>');
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate table of contents from headers
   */
  generateTableOfContents(headers) {
    console.log('[MarkdownViewer] Generating TOC with headers:', headers);
    
    if (!headers || headers.length === 0) {
      console.log('[MarkdownViewer] No headers found for TOC');
      return '<p class="toc-empty">No headings found</p>';
    }

    let tocHtml = '<ul class="toc-list">';
    let currentLevel = 1;

    headers.forEach(header => {
      if (header.level > currentLevel) {
        // Open nested lists
        for (let i = currentLevel; i < header.level; i++) {
          tocHtml += '<ul class="toc-list">';
        }
      } else if (header.level < currentLevel) {
        // Close nested lists
        for (let i = currentLevel; i > header.level; i--) {
          tocHtml += '</ul>';
        }
      }

      tocHtml += `<li class="toc-item toc-level-${header.level}">
        <a href="#${header.id}" class="toc-link">${header.title}</a>
      </li>`;

      currentLevel = header.level;
    });

    // Close remaining lists
    for (let i = currentLevel; i > 1; i--) {
      tocHtml += '</ul>';
    }
    tocHtml += '</ul>';

    console.log('[MarkdownViewer] Generated TOC HTML:', tocHtml);
    return tocHtml;
  }

  /**
   * Generate header ID from title
   */
  generateHeaderId(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  /**
   * Load highlight.js styles
   */
  loadHighlightStyles() {
    // Create basic highlight.js-like styles
    const style = document.createElement('style');
    style.textContent = `
      .hljs {
        background: var(--vscode-textCodeBlock-background);
        color: var(--vscode-textPreformat-foreground);
      }
      .hljs-keyword { color: var(--vscode-debugTokenExpression-name); }
      .hljs-string { color: var(--vscode-debugTokenExpression-string); }
      .hljs-comment { color: var(--vscode-descriptionForeground); font-style: italic; }
      .hljs-literal { color: var(--vscode-debugTokenExpression-boolean); }
      .hljs-number { color: var(--vscode-debugTokenExpression-number); }
      .hljs-tag { color: var(--vscode-debugTokenExpression-name); }
      .hljs-attr { color: var(--vscode-debugTokenExpression-string); }
      .hljs-value { color: var(--vscode-debugTokenExpression-value); }
      .hljs-property { color: var(--vscode-debugTokenExpression-name); }
      .hljs-selector { color: var(--vscode-debugTokenExpression-name); font-weight: bold; }
      .hljs-section { color: var(--vscode-debugTokenExpression-name); font-weight: bold; }
      .hljs-strong { font-weight: bold; }
      .hljs-emphasis { font-style: italic; }
      .hljs-code { background: var(--vscode-textCodeBlock-background); }
    `;
    document.head.appendChild(style);
  }

  /**
   * Render markdown content with TOC
   */
  renderContent(markdown) {
    try {
      console.log('[MarkdownViewer] Rendering content, length:', markdown ? markdown.length : 0);
      
      // Reset headers
      this.currentHeaders = [];

      // Convert markdown to HTML
      const html = this.markdownToHtml(markdown);
      this.contentDiv.innerHTML = html;

      console.log('[MarkdownViewer] Content rendered, headers found:', this.currentHeaders.length);

      // Generate and display table of contents
      this.updateTableOfContents();

      // Make links work within VS Code
      this.setupLinkHandlers();

      // Setup smooth scrolling for TOC links
      this.setupTocNavigation();

    } catch (error) {
      console.error('[MarkdownViewer] Error rendering content:', error);
      this.contentDiv.innerHTML = `<div class="error">Error rendering markdown: ${error.message}</div>`;
    }
  }

  /**
   * Update table of contents
   */
  updateTableOfContents() {
    console.log('[MarkdownViewer] Updating TOC, container exists:', !!this.tocContainer);
    
    if (this.tocContainer) {
      const tocHtml = this.generateTableOfContents(this.currentHeaders);
      this.tocContainer.innerHTML = `
        <div class="toc-header">
          <h3>Table of Contents</h3>
          <button id="toc-toggle" class="toc-toggle">Hide</button>
        </div>
        <div class="toc-content">
          ${tocHtml}
        </div>
      `;

      console.log('[MarkdownViewer] TOC HTML updated');

      // Setup TOC toggle for desktop
      this.setupTocToggle();
      
      // Setup mobile TOC toggle
      this.setupMobileTocToggle();
    } else {
      console.warn('[MarkdownViewer] TOC container not found');
    }
  }

  /**
   * Setup desktop TOC toggle functionality
   */
  setupTocToggle() {
    const toggleBtn = document.getElementById('toc-toggle');
    const tocContent = this.tocContainer.querySelector('.toc-content');
    
    if (toggleBtn && tocContent) {
      toggleBtn.addEventListener('click', () => {
        // Get computed display value instead of inline style
        const computedStyle = window.getComputedStyle(tocContent);
        const isVisible = computedStyle.display !== 'none' && tocContent.style.display !== 'none';
        
        if (isVisible) {
          tocContent.style.display = 'none';
          toggleBtn.textContent = 'Show';
        } else {
          tocContent.style.display = 'block';
          toggleBtn.textContent = 'Hide';
        }
      });
    }
  }

  /**
   * Setup mobile TOC toggle functionality
   */
  setupMobileTocToggle() {
    const mobileToggle = document.getElementById('toc-mobile-toggle');
    
    if (mobileToggle && this.tocContainer) {
      mobileToggle.addEventListener('click', () => {
        const isVisible = this.tocContainer.classList.contains('mobile-visible');
        
        if (isVisible) {
          this.tocContainer.classList.remove('mobile-visible');
          mobileToggle.textContent = '📋 TOC';
        } else {
          this.tocContainer.classList.add('mobile-visible');
          mobileToggle.textContent = '✖️ Close';
        }
      });
      
      // Close TOC when clicking outside on mobile
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1200 && 
            this.tocContainer.classList.contains('mobile-visible') &&
            !this.tocContainer.contains(e.target) &&
            !mobileToggle.contains(e.target)) {
          this.tocContainer.classList.remove('mobile-visible');
          mobileToggle.textContent = '📋 TOC';
        }
      });
    }
  }

  /**
   * Setup link handlers for VS Code integration
   */
  setupLinkHandlers() {
    const links = this.contentDiv.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.vscode.postMessage({
          type: 'executeCommand',
          payload: {
            command: 'vscode.open',
            args: [link.href]
          }
        });
      });
    });
  }

  /**
   * Setup smooth scrolling for TOC navigation
   */
  setupTocNavigation() {
    if (this.tocContainer) {
      const tocLinks = this.tocContainer.querySelectorAll('.toc-link');
      tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = link.getAttribute('href').substring(1);
          const targetElement = document.getElementById(targetId);
          
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Handle toolbar actions
    const refreshBtn = document.getElementById('refresh-btn');
    const printBtn = document.getElementById('print-btn');
    const exportBtn = document.getElementById('export-btn');
    const themeBtn = document.getElementById('theme-btn');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.vscode.postMessage({
          type: 'executeCommand',
          payload: { command: 'refresh' }
        });
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.vscode.postMessage({
          type: 'executeCommand',
          payload: { command: 'export' }
        });
      });
    }

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.switchTheme();
      });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('[MarkdownViewer] Received message:', message);

      switch (message.type) {
        case 'setContent':
          console.log('[MarkdownViewer] Setting content:', message.payload?.content?.substring(0, 100));
          this.renderContent(message.payload.content);
          
          // Show notification if content updated from file
          if (message.payload.fromFile) {
            this.showFileUpdateNotification();
          }
          break;

        case 'updateConfig':
          this.handleConfigUpdate(message.payload);
          break;

        case 'switchTheme':
          this.handleThemeSwitch(message.payload.theme);
          break;

        case 'executeCommand':
          // Handle command execution
          break;

        default:
          console.warn('[MarkdownViewer] Unknown message type:', message.type);
          break;
      }
    });

    // Notify extension that webview is ready
    this.vscode.postMessage({
      type: 'webviewReady',
      payload: {}
    });
  }

  /**
   * Switch between available themes
   */
  switchTheme() {
    const themes = ['default', 'dark', 'light', 'high-contrast'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    
    this.currentTheme = themes[nextIndex];
    this.applyTheme(this.currentTheme);

    // Notify extension of theme change
    this.vscode.postMessage({
      type: 'themeChanged',
      payload: { theme: this.currentTheme }
    });
  }

  /**
   * Apply theme to the viewer
   */
  applyTheme(theme) {
    document.body.className = `theme-${theme}`;
    
    // Update theme button text
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.title = `Current theme: ${theme}`;
    }
  }

  /**
   * Handle theme switch from extension
   */
  handleThemeSwitch(theme) {
    this.currentTheme = theme;
    this.applyTheme(theme);
  }

  /**
   * Handle configuration updates
   */
  handleConfigUpdate(config) {
    if (config.theme) {
      this.handleThemeSwitch(config.theme);
    }
    
    // Apply other configuration changes as needed
    console.log('[MarkdownViewer] Configuration updated:', config);
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

// Initialize the viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[MarkdownViewer] DOM loaded, initializing viewer');
  new MarkdownViewer();
});

// Fallback initialization if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[MarkdownViewer] DOM loaded (event), initializing viewer');
    new MarkdownViewer();
  });
} else {
  console.log('[MarkdownViewer] DOM already loaded, initializing viewer immediately');
  new MarkdownViewer();
}