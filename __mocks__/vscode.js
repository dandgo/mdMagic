/**
 * Mock implementation of the VS Code API for Jest testing
 */

const mockWebviewPanel = {
  webview: {
    html: '',
    onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
    postMessage: jest.fn(),
    options: {},
    cspSource: 'vscode-webview:',
    asWebviewUri: jest.fn((uri) => uri),
  },
  onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeViewState: jest.fn(() => ({ dispose: jest.fn() })),
  title: 'Test Panel',
  active: true,
  visible: true,
  reveal: jest.fn(),
  dispose: jest.fn(),
  viewType: 'test',
  viewColumn: 1,
};

// Mock FileSystemError class
class MockFileSystemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FileSystemError';
    this.code = 'Unknown';
  }
}

const vscode = {
  window: {
    createWebviewPanel: jest.fn(() => mockWebviewPanel),
    registerWebviewPanelSerializer: jest.fn(() => ({ dispose: jest.fn() })),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    activeTextEditor: null,
    visibleTextEditors: [],
    onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeVisibleTextEditors: jest.fn(() => ({ dispose: jest.fn() })),
    createOutputChannel: jest.fn(() => ({
      append: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
      hide: jest.fn(),
      show: jest.fn(),
    })),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
    Active: -1,
    Beside: -2,
  },
  Uri: {
    file: jest.fn((path) => ({ 
      fsPath: path, 
      toString: () => `file://${path}`,
      scheme: 'file',
      path: path,
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
    })),
    parse: jest.fn((uri) => ({
      fsPath: uri.replace('file://', ''),
      toString: () => uri,
      scheme: 'file',
      path: uri.replace('file://', ''),
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
    })),
    joinPath: jest.fn((...args) => ({
      fsPath: args.map(arg => typeof arg === 'string' ? arg : arg.fsPath).join('/'),
      toString: () => args.map(arg => typeof arg === 'string' ? arg : arg.toString()).join('/'),
      scheme: 'file',
      path: args.map(arg => typeof arg === 'string' ? arg : arg.fsPath).join('/'),
    })),
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
    registerTextEditorCommand: jest.fn(() => ({ dispose: jest.fn() })),
    getCommands: jest.fn(() => Promise.resolve([])),
  },
  env: {
    openExternal: jest.fn(),
    clipboard: {
      readText: jest.fn(() => Promise.resolve('')),
      writeText: jest.fn(() => Promise.resolve()),
    },
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      has: jest.fn(() => true),
      inspect: jest.fn(),
      update: jest.fn(() => Promise.resolve()),
    })),
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
    onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidCloseTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    fs: {
      readFile: jest.fn(() => Promise.resolve(new Uint8Array())),
      writeFile: jest.fn(() => Promise.resolve()),
      stat: jest.fn(() => Promise.resolve({
        type: 1, // FileType.File
        ctime: Date.now(),
        mtime: Date.now(),
        size: 1024,
      })),
      readDirectory: jest.fn(() => Promise.resolve([])),
      createDirectory: jest.fn(() => Promise.resolve()),
      delete: jest.fn(() => Promise.resolve()),
      rename: jest.fn(() => Promise.resolve()),
      copy: jest.fn(() => Promise.resolve()),
    },
    textDocuments: [],
    workspaceFolders: [],
    name: 'test-workspace',
    workspaceFile: undefined,
    updateWorkspaceFolders: jest.fn(),
    getWorkspaceFolder: jest.fn(),
    asRelativePath: jest.fn((path) => path),
    findFiles: jest.fn(() => Promise.resolve([])),
    openTextDocument: jest.fn(() => Promise.resolve({
      uri: { fsPath: 'test.md' },
      fileName: 'test.md',
      isUntitled: false,
      languageId: 'markdown',
      version: 1,
      isDirty: false,
      isClosed: false,
      save: jest.fn(() => Promise.resolve(true)),
      eol: 1,
      lineCount: 1,
      getText: jest.fn(() => '# Test'),
    })),
  },
  Disposable: jest.fn().mockImplementation((fn) => ({
    dispose: fn || jest.fn(),
  })),
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
  },
  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64,
  },
  FileSystemError: MockFileSystemError,
  ExtensionContext: jest.fn().mockImplementation(() => ({
    subscriptions: [],
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(() => Promise.resolve()),
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn(() => Promise.resolve()),
      setKeysForSync: jest.fn(),
    },
    extensionPath: '/test/extension/path',
    storagePath: '/test/storage/path',
    globalStoragePath: '/test/global/storage/path',
    logPath: '/test/log/path',
    extensionUri: {
      fsPath: '/test/extension/path',
      toString: () => 'file:///test/extension/path',
    },
    environmentVariableCollection: {
      replace: jest.fn(),
      append: jest.fn(),
      prepend: jest.fn(),
      get: jest.fn(),
      forEach: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    },
  })),
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: jest.fn().mockImplementation((id) => ({ id })),
  MarkdownString: jest.fn().mockImplementation((value) => ({
    value: value || '',
    isTrusted: false,
    supportThemeIcons: false,
    supportHtml: false,
    baseUri: undefined,
  })),
};

module.exports = vscode;