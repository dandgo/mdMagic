// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ExtensionController } from './controllers/ExtensionController';

// This method is called when your extension is activated
// Your extension is activated when a markdown file is opened
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    console.log('mdMagic extension is now active!');
    
    // Initialize the extension controller
    const controller = new ExtensionController(context);
    await controller.initialize();
  } catch (error) {
    console.error('Failed to activate mdMagic extension:', error);
    throw error;
  }
}

// This method is called when your extension is deactivated
export function deactivate(): void {
  console.log('mdMagic extension is being deactivated');
  
  // Dispose the extension controller
  const controller = ExtensionController.getInstance();
  if (controller) {
    controller.dispose();
  }
}
