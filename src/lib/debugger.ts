// src/lib/debugger.ts
import { useMemo } from 'react';
type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogCategory = 'auth' | 'events' | 'api' | 'ui' | 'db' | 'profile' | 'all' | 'validation' | 'storage' | 'component' | 'performance' | 'context' | 'notifications' | 'global';

interface DebugConfig {
  enabled: boolean;
  logLevel: LogLevel;
  categories: LogCategory[];
  showTimestamps: boolean;
  showComponentName: boolean;
  showStackTraces: boolean;
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  component: string;
  message: string;
  data?: any;
  stack?: string;
}

class DeveloperDebugger {
  private static instance: DeveloperDebugger;
  private config: DebugConfig;
  private logs: LogEntry[] = [];
  private activeTimers: Map<string, number> = new Map();

  private constructor() {
    const savedConfig = typeof window !== 'undefined' 
      ? localStorage.getItem('developer_debugger_config')
      : null;

    this.config = savedConfig 
      ? JSON.parse(savedConfig)
      : {
          enabled: false,
          logLevel: 'debug',
          categories: ['all'],
          showTimestamps: true,
          showComponentName: true,
          showStackTraces: false,
        };
  }

  static getInstance(): DeveloperDebugger {
    if (!DeveloperDebugger.instance) {
      DeveloperDebugger.instance = new DeveloperDebugger();
    }
    return DeveloperDebugger.instance;
  }

  private shouldLog(level: LogLevel, category: LogCategory): boolean {
    if (!this.config.enabled) return false;
    
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentPriority = levelPriority[level];
    const configPriority = levelPriority[this.config.logLevel];
    
    if (currentPriority < configPriority) return false;
    
    return this.config.categories.includes('all') || 
           this.config.categories.includes(category);
  }

  private formatMessage(
    level: LogLevel,
    category: LogCategory,
    component: string,
    message: string,
    data?: any
  ): string {
    const parts: string[] = [];
    
    if (this.config.showTimestamps) {
      parts.push(`[${new Date().toISOString().split('T')[1].slice(0, -1)}]`);
    }
    
    parts.push(`[${level.toUpperCase()}]`);
    
    if (this.config.showComponentName) {
      parts.push(`[${category.toUpperCase()}:${component}]`);
    } else {
      parts.push(`[${category.toUpperCase()}]`);
    }
    
    parts.push(message);
    
    if (data !== undefined) {
      try {
        parts.push(JSON.stringify(data, null, 2));
      } catch {
        parts.push('[Circular Data]');
      }
    }
    
    return parts.join(' ');
  }

  log(
    category: LogCategory,
    component: string,
    message: string,
    data?: any,
    level: LogLevel = 'info'
  ): void {
    if (!this.shouldLog(level, category)) return;
    
    const formatted = this.formatMessage(level, category, component, message, data);
    
    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
    
    if (this.config.enabled) {
      this.logs.push({
        timestamp: new Date(),
        level,
        category,
        component,
        message,
        data,
        stack: this.config.showStackTraces ? new Error().stack : undefined
      });
      
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-500);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('debugger:log', { 
          detail: this.logs[this.logs.length - 1] 
        }));
      }
    }
  }

  info(category: LogCategory, component: string, message: string, data?: any): void {
    this.log(category, component, message, data, 'info');
  }

  warn(category: LogCategory, component: string, message: string, data?: any): void {
    this.log(category, component, message, data, 'warn');
  }

  error(category: LogCategory, component: string, message: string, data?: any): void {
    this.log(category, component, message, data, 'error');
  }

  debug(category: LogCategory, component: string, message: string, data?: any): void {
    this.log(category, component, message, data, 'debug');
  }

  time(component: string, operation: string): () => number {
    const timerKey = `${component}:${operation}`;
    
    // Prevent duplicate timers
    if (this.activeTimers.has(timerKey)) {
      this.warn('performance', component, `Timer '${timerKey}' already exists`);
      const existingStart = this.activeTimers.get(timerKey)!;
      return () => performance.now() - existingStart;
    }
    
    const startTime = performance.now();
    this.activeTimers.set(timerKey, startTime);
    
    if (this.config.enabled) {
      console.time(timerKey);
    }
    
    return () => {
      const duration = performance.now() - startTime;
      this.activeTimers.delete(timerKey);
      
      if (this.config.enabled) {
        console.timeEnd(timerKey);
        this.debug('performance', component, `Operation '${operation}' completed in ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    };
  }

  trackClick(component: string, buttonName: string, event?: React.MouseEvent): void {
    this.debug('ui', component, `Button clicked: ${buttonName}`, {
      target: event?.currentTarget?.tagName,
      coordinates: event ? { x: event.clientX, y: event.clientY } : undefined,
      timestamp: event?.timeStamp
    });
  }

  trackApiRequest(
    component: string,
    endpoint: string,
    method: string,
    payload?: any
  ): void {
    this.info('api', component, `API Request: ${method} ${endpoint}`, payload);
  }

  trackApiResponse(
    component: string,
    endpoint: string,
    method: string,
    status: number,
    response?: any,
    duration?: number
  ): void {
    const logMethod = status >= 400 ? 'error' : 'info';
    const message = `API Response: ${method} ${endpoint} - ${status}`;
    const data: any = {};
    
    if (duration) data.duration = `${duration}ms`;
    if (response) data.response = response;
    
    if (logMethod === 'error') {
      this.error('api', component, message, data);
    } else {
      this.info('api', component, message, data);
    }
  }

  enable(): void {
    this.config.enabled = true;
    this.saveConfig();
    console.log('%c🛠️ Developer Debugger ENABLED', 'color: #4CAF50; font-weight: bold;');
  }

  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
    console.log('%c🛠️ Developer Debugger DISABLED', 'color: #f44336; font-weight: bold;');
  }

  toggle(): void {
    this.config.enabled = !this.config.enabled;
    this.saveConfig();
    console.log(`%c🛠️ Developer Debugger ${this.config.enabled ? 'ENABLED' : 'DISABLED'}`, 
      `color: ${this.config.enabled ? '#4CAF50' : '#f44336'}; font-weight: bold;`);
  }

  setConfig(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    this.debug('all', 'Debugger', 'Configuration updated', this.config);
  }

  getConfig(): DebugConfig {
    return { ...this.config };
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    console.clear();
    console.log('%c🛠️ Debug logs cleared', 'color: #FF9800; font-weight: bold;');
  }

  private saveConfig(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('developer_debugger_config', JSON.stringify(this.config));
    }
  }

  useDebug(componentName: string) {
    return {
      log: (category: LogCategory, message: string, data?: any) => 
        this.info(category, componentName, message, data),
      error: (category: LogCategory, message: string, error?: any) => 
        this.error(category, componentName, message, error),
      warn: (category: LogCategory, message: string, data?: any) => 
        this.warn(category, componentName, message, data),
      debug: (category: LogCategory, message: string, data?: any) => 
        this.debug(category, componentName, message, data),
      
      info: (category: LogCategory, message: string, data?: any) =>
        this.info(category, componentName, message, data),
      
      trackClick: (buttonName: string, event?: React.MouseEvent) =>
        this.trackClick(componentName, buttonName, event),
      trackApi: (endpoint: string, method: string, payload?: any) => 
        this.trackApiRequest(componentName, endpoint, method, payload),
      trackApiResponse: (endpoint: string, method: string, status: number, response?: any, duration?: number) =>
        this.trackApiResponse(componentName, endpoint, method, status, response, duration),
      
      time: (operation: string) => this.time(componentName, operation),
      
      clearLogs: () => this.clearLogs(),
      getLogs: () => this.getLogs(),
      getConfig: () => this.getConfig(),
      setConfig: (config: Partial<DebugConfig>) => this.setConfig(config),
      toggle: () => this.toggle(),
      enable: () => this.enable(),
      disable: () => this.disable()
    };
  }
}

export const debuggerInstance = DeveloperDebugger.getInstance();
export const useDebugger = (componentName: string) =>
  useMemo(() => debuggerInstance.useDebug(componentName), [componentName]);
