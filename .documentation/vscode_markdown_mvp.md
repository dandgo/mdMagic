# VS Code Markdown Editor/Viewer Extension MVP

## Overview

A VS Code extension that provides seamless switching between markdown editing and preview modes with WYSIWYG editing capabilities. The extension aims to streamline the markdown workflow by eliminating the friction between writing and previewing content.

## Core Features

### 1. Dual Mode Interface

**Editor Mode**
- WYSIWYG markdown editor with real-time formatting
- Syntax highlighting for raw markdown when needed
- Live preview of formatting changes
- Support for all standard markdown elements

**Viewer Mode**
- Clean, rendered markdown display
- Optimized for reading and presentation
- Support for custom CSS themes
- Print-friendly formatting

### 2. Seamless Mode Switching

**Keyboard Shortcuts**
- `Ctrl+Shift+M` (Windows/Linux) / `Cmd+Shift+M` (Mac) - Toggle between modes
- `Ctrl+Shift+E` / `Cmd+Shift+E` - Force editor mode
- `Ctrl+Shift+V` / `Cmd+Shift+V` - Force viewer mode

**UI Controls**
- Toggle button in editor toolbar
- Status bar indicator showing current mode
- Command palette integration
- Right-click context menu options

### 3. WYSIWYG Editor Features

**Real-time Formatting**
- Bold/italic text appears formatted as you type
- Headers show appropriate sizing and weight
- Lists display with proper indentation and bullets
- Links show as clickable elements
- Code blocks have syntax highlighting

**Toolbar Actions**
- Bold, italic, strikethrough buttons
- Header level selector (H1-H6)
- List formatting (ordered/unordered)
- Link insertion dialog
- Image insertion with preview
- Table creation wizard
- Code block formatting

**Smart Editing**
- Auto-completion for markdown syntax
- Smart paste (converts HTML to markdown)
- Drag-and-drop image insertion
- Table editing with visual grid

## Technical Requirements

### Extension Structure

```
markdown-editor-viewer/
├── package.json
├── README.md
├── src/
│   ├── extension.ts
│   ├── commands/
│   │   ├── toggleMode.ts
│   │   └── formatting.ts
│   ├── editor/
│   │   ├── wysiwygProvider.ts
│   │   └── toolbar.ts
│   ├── viewer/
│   │   ├── previewProvider.ts
│   │   └── renderer.ts
│   └── utils/
│       ├── markdown-parser.ts
│       └── config.ts
├── media/
│   ├── styles/
│   │   ├── editor.css
│   │   └── preview.css
│   └── icons/
└── webview/
    ├── editor.html
    ├── viewer.html
    └── scripts/
```

### Dependencies

**Core Libraries**
- `marked` - Markdown parsing and rendering
- `monaco-editor` - Enhanced text editing capabilities
- `highlight.js` - Syntax highlighting for code blocks
- `katex` - Math equation rendering (optional)

**VS Code APIs**
- `vscode.window.createWebviewPanel` - Custom editor interface
- `vscode.workspace.onDidChangeTextDocument` - Document change monitoring
- `vscode.commands.registerCommand` - Command registration

### Configuration Options

```json
{
  "markdownEditorViewer.defaultMode": {
    "type": "string",
    "default": "editor",
    "enum": ["editor", "viewer"],
    "description": "Default mode when opening markdown files"
  },
  "markdownEditorViewer.autoSave": {
    "type": "boolean",
    "default": true,
    "description": "Auto-save changes when switching modes"
  },
  "markdownEditorViewer.previewTheme": {
    "type": "string",
    "default": "github",
    "enum": ["github", "minimal", "dark"],
    "description": "Theme for preview mode"
  },
  "markdownEditorViewer.enableMath": {
    "type": "boolean",
    "default": false,
    "description": "Enable LaTeX math rendering"
  },
  "markdownEditorViewer.showToolbar": {
    "type": "boolean",
    "default": true,
    "description": "Show formatting toolbar in editor mode"
  }
}
```

## User Interface Design

### Editor Mode Layout

```
┌─────────────────────────────────────────────────────┐
│ [B] [I] [U] [H▼] [•] [1.] [🔗] [📷] [⚙] [👁] [⚡]    │ Toolbar
├─────────────────────────────────────────────────────┤
│                                                     │
│ # Welcome to My Document                            │
│                                                     │
│ This is **bold text** and this is *italic text*.   │
│                                                     │
│ - First item                                        │
│ - Second item                                       │
│                                                     │
│ [Link text](https://example.com)                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Viewer Mode Layout

```
┌─────────────────────────────────────────────────────┐
│                                           [✏] [⚡]    │ Minimal toolbar
├─────────────────────────────────────────────────────┤
│                                                     │
│ # Welcome to My Document                            │
│                                                     │
│ This is **bold text** and this is *italic text*.   │
│                                                     │
│ • First item                                        │
│ • Second item                                       │
│                                                     │
│ Link text                                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Basic Functionality (MVP)
- [ ] Basic editor/viewer mode switching
- [ ] Simple WYSIWYG formatting (bold, italic, headers)
- [ ] Keyboard shortcuts for mode switching
- [ ] Basic toolbar with essential formatting options
- [ ] File association with .md files

### Phase 2: Enhanced Editing
- [ ] Advanced WYSIWYG features (tables, links, images)
- [ ] Smart editing capabilities
- [ ] Improved toolbar with more formatting options
- [ ] Drag-and-drop support
- [ ] Auto-completion

### Phase 3: Advanced Features
- [ ] Custom themes and styling
- [ ] Math equation support
- [ ] Export functionality (PDF, HTML)
- [ ] Plugin system for extensions
- [ ] Collaborative editing features

## Success Metrics

**User Experience**
- Mode switching time < 500ms
- Zero data loss during mode transitions
- Intuitive keyboard shortcuts adoption > 80%

**Feature Adoption**
- WYSIWYG editor usage > 70% of editing time
- Toolbar usage for formatting > 60%
- User retention after 1 week > 85%

**Performance**
- Extension activation time < 200ms
- Memory usage < 50MB for typical documents
- Support for documents up to 1MB without performance degradation

## Competitive Analysis

**Existing Solutions**
- VS Code built-in markdown preview (view-only)
- Markdown All in One extension (limited WYSIWYG)
- Typora (external editor)

**Differentiation**
- Seamless in-editor switching
- True WYSIWYG editing within VS Code
- Optimized for developer workflow
- No context switching to external applications

## Future Enhancements

**Advanced Editor Features**
- Split-screen editing (raw + WYSIWYG)
- Advanced table editor with Excel-like features
- Mermaid diagram support
- Custom component plugins

**Integration Features**
- Git integration for markdown documentation
- Live collaboration with team members
- Integration with note-taking systems
- Export to various formats (PDF, DOCX, HTML)

**Accessibility**
- Screen reader support
- High contrast themes
- Keyboard-only navigation
- Voice command integration

## Technical Considerations

**Performance Optimization**
- Lazy loading of preview content
- Efficient diff algorithms for real-time updates
- Memory management for large documents
- Caching strategies for frequently accessed files

**Security**
- Sanitization of user input
- Safe HTML rendering
- Protection against XSS in preview mode
- Secure handling of external resources

**Cross-platform Compatibility**
- Windows, macOS, and Linux support
- Consistent keyboard shortcuts across platforms
- Platform-specific UI adaptations
- File path handling differences

## Conclusion

This MVP focuses on delivering a smooth, intuitive markdown editing experience that eliminates the friction between writing and previewing content. By prioritizing seamless mode switching and WYSIWYG editing capabilities, the extension will significantly improve the markdown workflow for VS Code users while maintaining the familiar environment they already know and love.