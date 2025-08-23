// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated when a markdown file is opened
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('mdMagic extension is now active!');

  // TODO: Initialize extension components here
  // - Document Manager
  // - Configuration Manager  
  // - Webview Provider
  // - Command Manager
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('mdMagic extension is being deactivated');
}
