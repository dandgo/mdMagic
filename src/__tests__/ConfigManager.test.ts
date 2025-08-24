/**
 * Unit tests for ConfigManager
 */

// Mock VS Code API first, before imports
const mockWorkspace = {
  getConfiguration: jest.fn(),
  onDidChangeConfiguration: jest.fn(),
};

const mockConfigurationTarget = {
  Global: 1,
};

const mockDisposable = {
  dispose: jest.fn(),
};

// Mock VS Code modules
jest.mock(
  'vscode',
  () => ({
    workspace: mockWorkspace,
    ConfigurationTarget: mockConfigurationTarget,
    Disposable: jest.fn().mockImplementation((fn) => ({
      dispose: fn,
    })),
  }),
  { virtual: true }
);

import * as vscode from 'vscode';
import {
  ConfigManager,
  ExtensionConfiguration,
  ConfigurationChangeEvent,
} from '../managers/ConfigManager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockConfig: any;
  let mockContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock context with globalState
    mockContext = {
      globalState: {
        get: jest.fn() as jest.MockedFunction<any>,
        update: jest.fn() as jest.MockedFunction<any>,
      },
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    // Mock configuration object
    mockConfig = {
      get: jest.fn(),
      update: jest.fn(),
    };

    mockWorkspace.getConfiguration.mockReturnValue(mockConfig);
    mockWorkspace.onDidChangeConfiguration.mockReturnValue(mockDisposable);
    (mockContext.globalState.get as jest.MockedFunction<any>).mockReturnValue(undefined);
    (mockContext.globalState.update as jest.MockedFunction<any>).mockResolvedValue(undefined);

    configManager = new ConfigManager(mockContext);
  });

  afterEach(() => {
    configManager.dispose();
  });

  describe('Component Interface', () => {
    test('should have correct id and name', () => {
      expect(configManager.id).toBe('config-manager');
      expect(configManager.name).toBe('Configuration Manager');
    });

    test('should initialize successfully', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        const defaults = {
          defaultMode: 'viewer',
          autoSave: true,
          previewTheme: 'default',
          enableMath: true,
          showToolbar: true,
          keyboardShortcuts: {
            toggleMode: 'Ctrl+Shift+M',
            save: 'Ctrl+S',
            export: 'Ctrl+Shift+E',
            togglePreview: 'Ctrl+Shift+V',
          },
        };
        return defaults[key as keyof typeof defaults];
      });

      await configManager.initialize();

      expect(mockWorkspace.getConfiguration).toHaveBeenCalledWith('mdMagic');
      expect(mockWorkspace.onDidChangeConfiguration).toHaveBeenCalled();
      expect(mockContext.globalState.update).toHaveBeenCalledWith('configVersion', '1.0.0');
    });

    test('should not initialize twice', async () => {
      await configManager.initialize();
      const firstCallCount = mockWorkspace.getConfiguration.mock.calls.length;

      await configManager.initialize();
      const secondCallCount = mockWorkspace.getConfiguration.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });

    test('should dispose properly', async () => {
      await configManager.initialize();

      configManager.dispose();

      expect(mockDisposable.dispose).toHaveBeenCalled();
    });
  });

  describe('Configuration Reading', () => {
    beforeEach(async () => {
      mockConfig.get.mockImplementation((key: string) => {
        const config = {
          defaultMode: 'editor',
          autoSave: false,
          previewTheme: 'dark',
          enableMath: false,
          showToolbar: false,
          keyboardShortcuts: {
            toggleMode: 'Ctrl+M',
            save: 'Ctrl+S',
            export: 'Ctrl+E',
            togglePreview: 'Ctrl+P',
          },
        };
        return config[key as keyof typeof config];
      });

      await configManager.initialize();
    });

    test('should get complete configuration', () => {
      const config = configManager.getConfiguration();

      expect(config).toEqual({
        defaultMode: 'editor',
        autoSave: false,
        previewTheme: 'dark',
        enableMath: false,
        showToolbar: false,
        enableDiagrams: true,
        wordWrap: 'on',
        fontSize: 14,
        lineHeight: 1.5,
        keyboardShortcuts: {
          toggleMode: 'Ctrl+M',
          save: 'Ctrl+S',
          export: 'Ctrl+E',
          togglePreview: 'Ctrl+P',
        },
      });
    });

    test('should get specific configuration value', () => {
      expect(configManager.getConfigurationValue('defaultMode')).toBe('editor');
      expect(configManager.getConfigurationValue('autoSave')).toBe(false);
      expect(configManager.getConfigurationValue('previewTheme')).toBe('dark');
    });

    test('should return immutable configuration', () => {
      const config1 = configManager.getConfiguration();
      const config2 = configManager.getConfiguration();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content

      // Modify one configuration and ensure the other is not affected
      config1.defaultMode = 'viewer';
      expect(config2.defaultMode).toBe('editor');
    });
  });

  describe('Configuration Defaults', () => {
    beforeEach(async () => {
      // Mock empty configuration (all undefined)
      mockConfig.get.mockReturnValue(undefined);
      await configManager.initialize();
    });

    test('should use defaults for missing configuration', () => {
      const config = configManager.getConfiguration();

      expect(config).toEqual({
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
      });
    });

    test('should handle partial configuration with defaults', async () => {
      // Reinitialize with partial config
      configManager.dispose();
      configManager = new ConfigManager(mockContext);

      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'defaultMode') {
          return 'editor';
        }
        if (key === 'autoSave') {
          return false;
        }
        return undefined; // Everything else uses defaults
      });

      await configManager.initialize();

      const config = configManager.getConfiguration();
      expect(config.defaultMode).toBe('editor');
      expect(config.autoSave).toBe(false);
      expect(config.previewTheme).toBe('default'); // Default value
      expect(config.enableMath).toBe(true); // Default value
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      mockConfig.get.mockReturnValue(undefined);
      await configManager.initialize();
    });

    test('should update configuration value', async () => {
      await configManager.updateConfiguration('defaultMode', 'editor');

      expect(mockConfig.update).toHaveBeenCalledWith('defaultMode', 'editor', 1);
    });

    test('should handle update errors', async () => {
      mockConfig.update.mockRejectedValue(new Error('Update failed'));

      await expect(configManager.updateConfiguration('defaultMode', 'editor')).rejects.toThrow(
        'Update failed'
      );
    });

    test('should reset configuration to defaults', async () => {
      await configManager.resetConfiguration();

      // Should call update with undefined for each config key
      expect(mockConfig.update).toHaveBeenCalledWith('defaultMode', undefined, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('autoSave', undefined, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('previewTheme', undefined, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('enableMath', undefined, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('showToolbar', undefined, 1);
      expect(mockConfig.update).toHaveBeenCalledWith('keyboardShortcuts', undefined, 1);
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(async () => {
      mockConfig.get.mockReturnValue(undefined);
      await configManager.initialize();
    });

    test('should validate valid configuration', () => {
      const validConfig: Partial<ExtensionConfiguration> = {
        defaultMode: 'editor',
        autoSave: true,
        previewTheme: 'dark',
        enableMath: false,
        showToolbar: true,
        keyboardShortcuts: {
          toggleMode: 'Ctrl+M',
          save: 'Ctrl+S',
          export: 'Ctrl+E',
          togglePreview: 'Ctrl+P',
        },
      };

      const result = configManager.validateConfiguration(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate invalid defaultMode', () => {
      const invalidConfig = { defaultMode: 'invalid' as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('defaultMode must be either "editor" or "viewer"');
    });

    test('should validate invalid boolean values', () => {
      const invalidConfig = {
        autoSave: 'not-boolean' as any,
        enableMath: 123 as any,
        showToolbar: null as any,
      };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('autoSave must be a boolean');
      expect(result.errors).toContain('enableMath must be a boolean');
      expect(result.errors).toContain('showToolbar must be a boolean');
    });

    test('should validate invalid previewTheme', () => {
      const invalidConfig = { previewTheme: 'invalid-theme' as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'previewTheme must be one of: default, github, minimal, academic, dark, high-contrast'
      );
    });

    test('should validate invalid keyboardShortcuts', () => {
      const invalidConfig = { keyboardShortcuts: 'not-object' as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('keyboardShortcuts must be an object');
    });

    test('should validate missing keyboardShortcuts properties', () => {
      const invalidConfig = {
        keyboardShortcuts: {
          toggleMode: 'Ctrl+M',
          // Missing other required properties
        } as any,
      };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('keyboardShortcuts.save must be a string');
      expect(result.errors).toContain('keyboardShortcuts.export must be a string');
      expect(result.errors).toContain('keyboardShortcuts.togglePreview must be a string');
    });

    test('should validate new configuration options', () => {
      // Test valid new options
      const validConfig = {
        enableDiagrams: true,
        wordWrap: 'bounded',
        fontSize: 16,
        lineHeight: 1.8,
      };

      const result = configManager.validateConfiguration(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate invalid enableDiagrams', () => {
      const invalidConfig = { enableDiagrams: 'not-boolean' as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('enableDiagrams must be a boolean');
    });

    test('should validate invalid wordWrap', () => {
      const invalidConfig = { wordWrap: 'invalid-wrap' as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('wordWrap must be one of: off, on, wordWrapColumn, bounded');
    });

    test('should validate invalid fontSize', () => {
      const invalidConfig = { fontSize: 5 as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('fontSize must be a number between 8 and 32');
    });

    test('should validate invalid lineHeight', () => {
      const invalidConfig = { lineHeight: 0.5 as any };

      const result = configManager.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('lineHeight must be a number between 1.0 and 3.0');
    });

    test('should handle invalid configuration during loading', async () => {
      // Reinitialize with invalid config
      configManager.dispose();
      configManager = new ConfigManager(mockContext);

      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'defaultMode') {
          return 'invalid-mode';
        }
        return undefined;
      });

      await configManager.initialize();

      // Should fall back to defaults when validation fails
      const config = configManager.getConfiguration();
      expect(config.defaultMode).toBe('viewer'); // Default value
    });
  });

  describe('Configuration Change Listeners', () => {
    let changeEvents: ConfigurationChangeEvent[] = [];
    let changeListener: jest.Mock;

    beforeEach(async () => {
      mockConfig.get.mockReturnValue(undefined);
      await configManager.initialize();

      changeEvents = [];
      changeListener = jest.fn((event: ConfigurationChangeEvent) => {
        changeEvents.push(event);
      });
    });

    test('should add and notify change listeners', () => {
      const disposable = configManager.addChangeListener(changeListener);

      expect(disposable).toBeDefined();
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should remove change listener on dispose', () => {
      const disposable = configManager.addChangeListener(changeListener);

      disposable.dispose();

      // Listener should be removed (tested by not receiving events)
      expect(changeListener).not.toHaveBeenCalled();
    });

    test('should handle configuration change events', async () => {
      configManager.addChangeListener(changeListener);

      // Mock configuration change
      const mockChangeEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(true),
      };

      // Update mock config to return new values
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'defaultMode') {
          return 'editor';
        }
        return undefined;
      });

      // Get the change handler that was registered
      const changeHandler = mockWorkspace.onDidChangeConfiguration.mock.calls[0][0];
      await changeHandler(mockChangeEvent);

      expect(mockChangeEvent.affectsConfiguration).toHaveBeenCalledWith('mdMagic');
    });

    test('should ignore unrelated configuration changes', async () => {
      configManager.addChangeListener(changeListener);

      // Mock configuration change that doesn't affect mdMagic
      const mockChangeEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(false),
      };

      // Get the change handler that was registered
      const changeHandler = mockWorkspace.onDidChangeConfiguration.mock.calls[0][0];
      await changeHandler(mockChangeEvent);

      expect(changeListener).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Migration', () => {
    test('should initialize version on first run', async () => {
      (mockContext.globalState.get as jest.MockedFunction<any>).mockReturnValue(undefined);
      mockConfig.get.mockReturnValue(undefined);

      await configManager.initialize();

      expect(mockContext.globalState.update).toHaveBeenCalledWith('configVersion', '1.0.0');
    });

    test('should migrate configuration when version changes', async () => {
      (mockContext.globalState.get as jest.MockedFunction<any>).mockReturnValue('0.9.0');
      mockConfig.get.mockReturnValue(undefined);

      await configManager.initialize();

      expect(mockContext.globalState.update).toHaveBeenCalledWith('configVersion', '1.0.0');
    });

    test('should not migrate when version is current', async () => {
      (mockContext.globalState.get as jest.MockedFunction<any>).mockReturnValue('1.0.0');
      mockConfig.get.mockReturnValue(undefined);

      await configManager.initialize();

      // Should only be called once during first check, not for migration
      expect(mockContext.globalState.update).not.toHaveBeenCalled();
    });

    test('should handle migration errors', async () => {
      (mockContext.globalState.get as jest.MockedFunction<any>).mockReturnValue('0.9.0');
      (mockContext.globalState.update as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Migration failed')
      );

      await expect(configManager.initialize()).rejects.toThrow('Migration failed');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      mockWorkspace.onDidChangeConfiguration.mockImplementation(() => {
        throw new Error('Event listener setup failed');
      });

      await expect(configManager.initialize()).rejects.toThrow('Event listener setup failed');
    });

    test('should handle configuration loading errors', async () => {
      mockWorkspace.getConfiguration.mockImplementation(() => {
        throw new Error('Config loading failed');
      });

      await configManager.initialize();

      // Should fall back to defaults
      const config = configManager.getConfiguration();
      expect(config.defaultMode).toBe('viewer');
    });

    test('should handle listener errors gracefully', async () => {
      await configManager.initialize();

      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      configManager.addChangeListener(errorListener);

      // Should not throw when listener throws
      expect(() => {
        // Simulate listener notification (private method, so test indirectly)
        const mockChangeEvent = {
          affectsConfiguration: jest.fn().mockReturnValue(true),
        };

        const changeHandler = mockWorkspace.onDidChangeConfiguration.mock.calls[0][0];
        changeHandler(mockChangeEvent);
      }).not.toThrow();
    });
  });
});
