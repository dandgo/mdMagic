/**
 * Mock implementation of the VS Code API for Jest testing
 */

const mockWebviewPanel = {
  webview: {
    html: '',
    onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
    postMessage: jest.fn(),
  },
  onDidDispose: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeViewState: jest.fn(() => ({ dispose: jest.fn() })),
  title: 'Test Panel',
  active: true,
  visible: true,
  reveal: jest.fn(),
  dispose: jest.fn(),
};

const vscode = {
  window: {
    createWebviewPanel: jest.fn(() => mockWebviewPanel),
    registerWebviewPanelSerializer: jest.fn(() => ({ dispose: jest.fn() })),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
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
    })),
    parse: jest.fn((uri) => ({
      fsPath: uri.replace('file://', ''),
      toString: () => uri,
      scheme: 'file',
      path: uri.replace('file://', ''),
    })),
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  },
  env: {
    openExternal: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
      update: jest.fn(),
    })),
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
    onDidOpenTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidCloseTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      stat: jest.fn(),
    },
    textDocuments: [],
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
  FileSystemError: class extends Error {
    constructor(message) {
      super(message);
      this.code = 'Unknown';
    }
  },
};

module.exports = vscode;