# mdMagic VS Code Extension Development Instructions

Always follow these instructions first and fallback to additional search and context gathering only if the information in these instructions is incomplete or found to be in error.

## Project Overview

**mdMagic** is a VS Code markdown extension providing a powerful WYSIWYG editor and viewer for markdown files. This is currently in the planning phase with detailed documentation but no implementation yet.

- **Extension Name**: Markdown Editor/Viewer (mdMagic)
- **Target VS Code API**: 1.74+
- **Technology Stack**: TypeScript, Node.js, Webpack/ESBuild, Monaco Editor, Marked.js
- **Estimated Timeline**: 8-12 weeks across 6 development phases
- **Current State**: Planning phase - no extension code yet, only documentation

## Working Effectively

### Initial Setup and Environment
**CRITICAL**: This repository contains only planning documentation. To start development:

1. **Install Required Global Tools** (15-30 seconds each):
   ```bash
   npm install -g yo generator-code @vscode/vsce
   ```

2. **Verify Tool Installation**:
   ```bash
   yo --version    # Should output 5.x.x
   vsce --version  # Should output 3.x.x
   node --version  # Should output 16+ (verified: v20.19.4 available)
   npm --version   # Should output 8+ (verified: v10.8.2 available)
   ```

### Creating the VS Code Extension Project
**NEVER CANCEL** - Project generation takes 2-4 minutes including npm install.

1. **Initialize VS Code Extension** (2-4 minutes total - NEVER CANCEL):
   ```bash
   yo code
   # Select: "New Extension (TypeScript)"
   # Name: mdMagic
   # Identifier: mdMagic (or mdmagic)
   # Description: VS Code Markdown Extension - A powerful WYSIWYG editor and viewer for markdown files
   # Initialize git repository: No (already exists)
   # Bundle source code: webpack (for production) or esbuild (faster builds)
   # Package manager: npm
   ```

2. **Add Essential Dependencies for Markdown Extension** (1-2 minutes):
   ```bash
   npm install marked highlight.js katex mermaid
   npm install --save-dev @types/marked
   ```

3. **Fix TypeScript Configuration for DOM dependencies**:
   - Edit `tsconfig.json` to include DOM lib:
   ```json
   {
     "compilerOptions": {
       "lib": ["ES2022", "DOM"]
     }
   }
   ```

### Build and Development Commands

**CRITICAL TIMING WARNINGS**:
- **Build commands take 3-5 seconds** - Set timeout to 30+ seconds
- **npm install takes 1-3 minutes** - Set timeout to 300+ seconds  
- **Tests will fail** in sandbox environment due to VS Code dependency - this is expected
- **NEVER CANCEL** any build or install commands

1. **Core Development Commands**:
   ```bash
   npm run compile        # Build TypeScript (3-5 seconds)
   npm run package        # Production build (3-5 seconds)
   npm run lint          # ESLint check (1-2 seconds)
   npm run check-types   # TypeScript type check (2-3 seconds)
   vsce package --allow-missing-repository  # Create VSIX (4-6 seconds)
   ```

2. **Expected Command Results**:
   ```bash
   npm run compile   # ✅ Should succeed - "build finished"
   npm test          # ❌ Will fail - "getaddrinfo ENOTFOUND" (expected in sandbox)
   npm run lint      # ✅ Should succeed - no output means success
   npm run package   # ✅ Should succeed - "build finished"
   ```

### Project Structure Understanding

**Key Documentation Files** (Read these first):
```
.documentation/
├── vscode_markdown_architecture.md  # System architecture
├── vscode_markdown_dev_tasks.md     # 21 development tasks across 6 phases
└── vscode_markdown_mvp.md           # MVP requirements
SETUP.md                             # Project setup guide
github-issues.md                     # Pre-prepared GitHub issues
```

**Expected Extension Structure** (After yo code):
```
src/
├── extension.ts                     # Main extension entry point
├── controllers/                     # Extension, Document, Command controllers
├── webview/                        # Editor and Viewer webview providers
├── managers/                       # Mode, Config, Document managers
└── test/                           # Unit and integration tests
```

## Development Phases and Tasks

### Phase 1: Foundation & Core Infrastructure (Weeks 1-3)
- **Task 1.1**: Project setup using `yo code` (8 hours)
- **Task 1.2**: Extension Controller and lifecycle (12 hours)
- **Task 1.3**: Document Manager implementation (16 hours)
- **Task 1.4**: Configuration Manager (8 hours)

### Phase 2: Core Webview System (Weeks 3-5)
- **Task 2.1**: Webview Provider framework (12 hours)
- **Task 2.2**: Editor Webview Implementation (24 hours - LONGEST TASK)
- **Task 2.3**: Viewer Webview Implementation (16 hours)
- **Task 2.4**: Mode Manager and switching (12 hours)

### Phase 3: User Interface and Commands (Weeks 5-7)
- **Task 3.1**: Command System Implementation (16 hours)
- **Task 3.2**: Toolbar and Controls (12 hours)
- **Task 3.3**: Status Bar Integration (6 hours - SHORTEST TASK)
- **Task 3.4**: Context Menu Support (8 hours)

### Phase 4: Advanced Features and Polish (Weeks 7-9)
- **Task 4.1**: WYSIWYG Features (20 hours)
- **Task 4.2**: Theme System Implementation (12 hours)
- **Task 4.3**: Export Functionality (16 hours)
- **Task 4.4**: Settings and Preferences (8 hours)

### Phase 5: Testing and Quality Assurance (Weeks 9-10)
- **Task 5.1**: Unit Testing Implementation (24 hours)
- **Task 5.2**: Integration Testing (16 hours)
- **Task 5.3**: Manual Testing and Bug Fixes (20 hours)

### Phase 6: Documentation and Release (Weeks 10-12)
- **Task 6.1**: User Documentation (12 hours)
- **Task 6.2**: Developer Documentation (12 hours)
- **Task 6.3**: Marketplace Preparation (16 hours)

## Validation and Testing

### Manual Validation Requirements
**ALWAYS** run through these scenarios after making changes:

1. **Extension Activation Test**:
   - Open a .md file in VS Code
   - Verify extension activates without errors
   - Check developer console for any error messages

2. **Build Validation**:
   ```bash
   npm run compile && npm run lint && npm run package
   # All three commands must succeed
   ```

3. **VSIX Package Test**:
   ```bash
   echo "# Test Extension" > README.md
   echo "MIT License" > LICENSE
   vsce package --allow-missing-repository
   # Should create .vsix file successfully
   ```

4. **Core Functionality Test** (Once implemented):
   - Toggle between Editor and Viewer modes
   - Test markdown rendering in viewer
   - Test WYSIWYG editing features
   - Verify toolbar and command palette integration

### Known Issues and Limitations

1. **Test Runner Limitations**:
   - `npm test` will fail in sandbox environments
   - VS Code test runner requires VS Code installation
   - Focus on manual testing and build validation

2. **Dependency Conflicts**:
   - Do NOT install Jest alongside Mocha (default VS Code testing)
   - D3-based libraries (mermaid, katex) require DOM types in tsconfig.json
   - TypeScript strict mode may require additional type definitions

3. **Build Environment**:
   - Network access may be limited for external dependencies
   - `yo code` may show VS Code version detection warnings (ignore these)
   - VSIX packaging requires README.md and LICENSE files

## Performance Targets

**Extension Performance Goals**:
- Extension activation time: < 200ms
- Mode switching time: < 500ms  
- Memory usage: < 50MB for typical documents
- Document loading time: < 1 second for files up to 1MB

**Build Time Expectations**:
- TypeScript compilation: 2-3 seconds
- Webpack/ESBuild bundling: 3-5 seconds
- Full build pipeline: 5-10 seconds
- npm install (initial): 1-3 minutes - NEVER CANCEL

## Code Quality Standards

**Always follow these standards**:
- Use TypeScript strict mode with no implicit any
- Implement proper error handling with custom error types
- Use async/await for asynchronous operations
- Follow SOLID principles
- Target minimum 85% code coverage (when testing is implemented)

**Required Commands Before Committing**:
```bash
npm run lint      # Must pass
npm run compile   # Must succeed  
npm run package   # Must create bundle successfully
```

## Common File Operations

### Key Files to Modify During Development

1. **package.json**: Extension manifest, commands, activation events
2. **src/extension.ts**: Main extension entry point
3. **tsconfig.json**: TypeScript configuration (add DOM lib for markdown deps)
4. **webpack.config.js** or **esbuild.js**: Build configuration
5. **.vscode/launch.json**: VS Code debugging configuration

### Essential VS Code Extension Files

```
package.json          # Extension manifest and metadata
src/extension.ts      # activate() and deactivate() functions
.vscode/launch.json   # Debug configuration for F5 testing
.vscodeignore        # Files to exclude from VSIX package
```

## Troubleshooting Common Issues

1. **"yo code" fails**: Ensure Yeoman and generator-code are installed globally
2. **Build fails with DOM errors**: Add "DOM" to tsconfig.json lib array
3. **vsce package fails**: Ensure README.md exists and doesn't contain template text
4. **Extension doesn't activate**: Check package.json activationEvents
5. **TypeScript errors**: Run `npm run check-types` for detailed type errors

## Next Steps for New Developers

1. **Start Here**: Read all documentation in `.documentation/` folder
2. **Review Planning**: Check `github-issues.md` for detailed task breakdown
3. **Set Up Environment**: Run the global tool installation commands above
4. **Create Extension**: Use `yo code` to initialize the project structure
5. **Begin Development**: Start with Phase 1, Task 1.1 (Project Setup)

Remember: This project is in planning phase. The architecture and task breakdown are complete, but implementation needs to be done following the detailed specifications in the documentation files.