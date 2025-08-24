/**
 * ConfigManager - Manages extension configuration, validation, and change listeners
 * Provides real-time configuration updates and migration support
 */

import * as vscode from 'vscode';
import { Component } from '../controllers/ExtensionController';

// Configuration schema interfaces
export interface KeyboardShortcuts {
  toggleMode: string;
  save: string;
  export: string;
  togglePreview: string;
}

export interface ExtensionConfiguration {
  defaultMode: 'editor' | 'viewer';
  autoSave: boolean;
  previewTheme: 'default' | 'github' | 'minimal' | 'academic' | 'dark' | 'high-contrast';
  enableMath: boolean;
  showToolbar: boolean;
  enableDiagrams: boolean;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  fontSize: number;
  lineHeight: number;
  keyboardShortcuts: KeyboardShortcuts;
}

export interface ConfigurationChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
}

export type ConfigurationChangeListener = (event: ConfigurationChangeEvent) => void;

export interface IConfigManager extends Component {
  getConfiguration(): ExtensionConfiguration;
  getConfigurationValue<K extends keyof ExtensionConfiguration>(key: K): ExtensionConfiguration[K];
  updateConfiguration<K extends keyof ExtensionConfiguration>(
    key: K,
    value: ExtensionConfiguration[K]
  ): Promise<void>;
  resetConfiguration(): Promise<void>;
  addChangeListener(listener: ConfigurationChangeListener): vscode.Disposable;
  validateConfiguration(config: Partial<ExtensionConfiguration>): {
    isValid: boolean;
    errors: string[];
  };
}

export class ConfigManager implements IConfigManager {
  public readonly id = 'config-manager';
  public readonly name = 'Configuration Manager';

  private static readonly EXTENSION_NAMESPACE = 'mdMagic';
  private static readonly CONFIG_VERSION_KEY = 'configVersion';
  private static readonly CURRENT_VERSION = '1.0.0';

  private currentConfiguration: ExtensionConfiguration;
  private changeListeners: ConfigurationChangeListener[] = [];
  private disposables: vscode.Disposable[] = [];
  private isInitialized = false;

  // Default configuration values
  private readonly defaultConfiguration: ExtensionConfiguration = {
    defaultMode: 'viewer',
    autoSave: true,
    previewTheme: 'default',
    enableMath: true,
    showToolbar: true,
    enableDiagrams: true,
    wordWrap: 'on',
    fontSize: 14,
    lineHeight: 1.5,
    keyboardShortcuts: {
      toggleMode: 'Ctrl+Shift+M',
      save: 'Ctrl+S',
      export: 'Ctrl+Shift+E',
      togglePreview: 'Ctrl+Shift+V',
    },
  };

  constructor(private context: vscode.ExtensionContext) {
    this.currentConfiguration = { ...this.defaultConfiguration };
  }

  /**
   * Initialize the configuration manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logInfo('Initializing Configuration Manager...');

      // Perform configuration migration if needed
      await this.migrateConfiguration();

      // Load current configuration
      await this.loadConfiguration();

      // Set up configuration change listener
      const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
        this.handleConfigurationChange.bind(this)
      );
      this.disposables.push(configChangeDisposable);

      this.isInitialized = true;
      this.logInfo('Configuration Manager initialized successfully');
    } catch (error) {
      this.logError('Failed to initialize Configuration Manager', error);
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.logInfo('Disposing Configuration Manager...');

    this.changeListeners = [];

    this.disposables.forEach((disposable) => {
      try {
        disposable.dispose();
      } catch (error) {
        this.logError('Error disposing configuration manager resource', error);
      }
    });
    this.disposables = [];

    this.isInitialized = false;
    this.logInfo('Configuration Manager disposed successfully');
  }

  /**
   * Get the complete configuration
   */
  public getConfiguration(): ExtensionConfiguration {
    return { ...this.currentConfiguration };
  }

  /**
   * Get a specific configuration value
   */
  public getConfigurationValue<K extends keyof ExtensionConfiguration>(
    key: K
  ): ExtensionConfiguration[K] {
    return this.currentConfiguration[key];
  }

  /**
   * Update a configuration value
   */
  public async updateConfiguration<K extends keyof ExtensionConfiguration>(
    key: K,
    value: ExtensionConfiguration[K]
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(ConfigManager.EXTENSION_NAMESPACE);
      await config.update(key, value, vscode.ConfigurationTarget.Global);
      this.logInfo(`Configuration updated: ${String(key)} = ${JSON.stringify(value)}`);
    } catch (error) {
      this.logError(`Failed to update configuration: ${String(key)}`, error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetConfiguration(): Promise<void> {
    try {
      this.logInfo('Resetting configuration to defaults...');
      const config = vscode.workspace.getConfiguration(ConfigManager.EXTENSION_NAMESPACE);

      // Reset each configuration key
      for (const key of Object.keys(this.defaultConfiguration) as Array<
        keyof ExtensionConfiguration
      >) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Global);
      }

      // Reload configuration
      await this.loadConfiguration();
      this.logInfo('Configuration reset to defaults successfully');
    } catch (error) {
      this.logError('Failed to reset configuration', error);
      throw error;
    }
  }

  /**
   * Add a configuration change listener
   */
  public addChangeListener(listener: ConfigurationChangeListener): vscode.Disposable {
    this.changeListeners.push(listener);

    return new vscode.Disposable(() => {
      const index = this.changeListeners.indexOf(listener);
      if (index !== -1) {
        this.changeListeners.splice(index, 1);
      }
    });
  }

  /**
   * Validate configuration values
   */
  public validateConfiguration(config: Partial<ExtensionConfiguration>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate defaultMode
    if (config.defaultMode !== undefined) {
      if (!['editor', 'viewer'].includes(config.defaultMode)) {
        errors.push('defaultMode must be either "editor" or "viewer"');
      }
    }

    // Validate autoSave
    if (config.autoSave !== undefined && typeof config.autoSave !== 'boolean') {
      errors.push('autoSave must be a boolean');
    }

    // Validate previewTheme
    if (config.previewTheme !== undefined) {
      const validThemes = ['default', 'github', 'minimal', 'academic', 'dark', 'high-contrast'];
      if (!validThemes.includes(config.previewTheme)) {
        errors.push(`previewTheme must be one of: ${validThemes.join(', ')}`);
      }
    }

    // Validate enableMath
    if (config.enableMath !== undefined && typeof config.enableMath !== 'boolean') {
      errors.push('enableMath must be a boolean');
    }

    // Validate showToolbar
    if (config.showToolbar !== undefined && typeof config.showToolbar !== 'boolean') {
      errors.push('showToolbar must be a boolean');
    }

    // Validate enableDiagrams
    if (config.enableDiagrams !== undefined && typeof config.enableDiagrams !== 'boolean') {
      errors.push('enableDiagrams must be a boolean');
    }

    // Validate wordWrap
    if (config.wordWrap !== undefined) {
      const validWrapValues = ['off', 'on', 'wordWrapColumn', 'bounded'];
      if (!validWrapValues.includes(config.wordWrap)) {
        errors.push(`wordWrap must be one of: ${validWrapValues.join(', ')}`);
      }
    }

    // Validate fontSize
    if (config.fontSize !== undefined) {
      if (typeof config.fontSize !== 'number' || config.fontSize < 8 || config.fontSize > 32) {
        errors.push('fontSize must be a number between 8 and 32');
      }
    }

    // Validate lineHeight
    if (config.lineHeight !== undefined) {
      if (typeof config.lineHeight !== 'number' || config.lineHeight < 1.0 || config.lineHeight > 3.0) {
        errors.push('lineHeight must be a number between 1.0 and 3.0');
      }
    }

    // Validate keyboardShortcuts
    if (config.keyboardShortcuts !== undefined) {
      if (typeof config.keyboardShortcuts !== 'object' || config.keyboardShortcuts === null) {
        errors.push('keyboardShortcuts must be an object');
      } else {
        const shortcuts = config.keyboardShortcuts;
        const requiredKeys = ['toggleMode', 'save', 'export', 'togglePreview'];

        for (const key of requiredKeys) {
          if (
            !(key in shortcuts) ||
            typeof shortcuts[key as keyof KeyboardShortcuts] !== 'string'
          ) {
            errors.push(`keyboardShortcuts.${key} must be a string`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Load configuration from VS Code settings
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(ConfigManager.EXTENSION_NAMESPACE);

      // Build configuration with defaults for missing values
      const loadedConfig: ExtensionConfiguration = {
        defaultMode: config.get('defaultMode') ?? this.defaultConfiguration.defaultMode,
        autoSave: config.get('autoSave') ?? this.defaultConfiguration.autoSave,
        previewTheme: config.get('previewTheme') ?? this.defaultConfiguration.previewTheme,
        enableMath: config.get('enableMath') ?? this.defaultConfiguration.enableMath,
        showToolbar: config.get('showToolbar') ?? this.defaultConfiguration.showToolbar,
        enableDiagrams: config.get('enableDiagrams') ?? this.defaultConfiguration.enableDiagrams,
        wordWrap: config.get('wordWrap') ?? this.defaultConfiguration.wordWrap,
        fontSize: config.get('fontSize') ?? this.defaultConfiguration.fontSize,
        lineHeight: config.get('lineHeight') ?? this.defaultConfiguration.lineHeight,
        keyboardShortcuts: {
          ...this.defaultConfiguration.keyboardShortcuts,
          ...(config.get('keyboardShortcuts') ?? {}),
        },
      };

      // Validate loaded configuration
      const validation = this.validateConfiguration(loadedConfig);
      if (!validation.isValid) {
        this.logWarning(`Configuration validation failed: ${validation.errors.join(', ')}`);
        // Use defaults for invalid configuration
        this.currentConfiguration = { ...this.defaultConfiguration };
      } else {
        this.currentConfiguration = loadedConfig;
      }

      this.logInfo('Configuration loaded successfully');
    } catch (error) {
      this.logError('Failed to load configuration, using defaults', error);
      this.currentConfiguration = { ...this.defaultConfiguration };
    }
  }

  /**
   * Handle VS Code configuration changes
   */
  private async handleConfigurationChange(e: vscode.ConfigurationChangeEvent): Promise<void> {
    if (!e.affectsConfiguration(ConfigManager.EXTENSION_NAMESPACE)) {
      return;
    }

    try {
      const oldConfiguration = { ...this.currentConfiguration };
      await this.loadConfiguration();

      // Notify listeners of changes
      for (const key of Object.keys(this.currentConfiguration) as Array<
        keyof ExtensionConfiguration
      >) {
        const oldValue = oldConfiguration[key];
        const newValue = this.currentConfiguration[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          const event: ConfigurationChangeEvent = {
            key: String(key),
            oldValue,
            newValue,
            timestamp: new Date(),
          };

          this.notifyChangeListeners(event);
        }
      }
    } catch (error) {
      this.logError('Failed to handle configuration change', error);
    }
  }

  /**
   * Notify configuration change listeners
   */
  private notifyChangeListeners(event: ConfigurationChangeEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logError('Error in configuration change listener', error);
      }
    });
  }

  /**
   * Migrate configuration between versions
   */
  private async migrateConfiguration(): Promise<void> {
    try {
      const storedVersion = this.context.globalState.get<string>(ConfigManager.CONFIG_VERSION_KEY);

      if (!storedVersion) {
        // First time setup
        await this.context.globalState.update(
          ConfigManager.CONFIG_VERSION_KEY,
          ConfigManager.CURRENT_VERSION
        );
        this.logInfo('Configuration initialized for first time');
        return;
      }

      if (storedVersion !== ConfigManager.CURRENT_VERSION) {
        this.logInfo(
          `Migrating configuration from version ${storedVersion} to ${ConfigManager.CURRENT_VERSION}`
        );

        // Add migration logic here for future versions
        // For now, just update the version
        await this.context.globalState.update(
          ConfigManager.CONFIG_VERSION_KEY,
          ConfigManager.CURRENT_VERSION
        );

        this.logInfo('Configuration migration completed');
      }
    } catch (error) {
      this.logError('Failed to migrate configuration', error);
      throw error;
    }
  }

  /**
   * Log info messages
   */
  private logInfo(message: string): void {
    console.log(`[mdMagic ConfigManager] ${message}`);
  }

  /**
   * Log warning messages
   */
  private logWarning(message: string): void {
    console.warn(`[mdMagic ConfigManager Warning] ${message}`);
  }

  /**
   * Log error messages
   */
  private logError(message: string, error?: unknown): void {
    console.error(`[mdMagic ConfigManager Error] ${message}`);

    if (error instanceof Error && error.stack) {
      console.error(`[mdMagic ConfigManager Error Stack] ${error.stack}`);
    }
  }
}
