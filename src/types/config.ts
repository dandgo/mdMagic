/**
 * Configuration-related type definitions
 */

export interface ConfigurationSchema {
  defaultMode: 'editor' | 'viewer';
  autoSave: boolean;
  previewTheme: 'default' | 'github' | 'minimal' | 'academic' | 'dark' | 'high-contrast';
  enableMath: boolean;
  showToolbar: boolean;
  enableDiagrams: boolean;
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  fontSize: number;
  lineHeight: number;
  keyboardShortcuts: {
    toggleMode: string;
    save: string;
    export: string;
    togglePreview: string;
  };
}

export interface ConfigChangeEvent {
  key: keyof ConfigurationSchema;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;