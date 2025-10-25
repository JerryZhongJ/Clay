/**
 * 基础类型定义
 */

export interface Entity {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export interface LogFilter {
  level?: LogEntry['level'];
  startTime?: Date;
  endTime?: Date;
  faculty?: string;
  search?: string;
}

/**
 * 优先级常量
 */
export const PRIORITY_LOWEST = 0;
export const PRIORITY_HIGHEST = 9;
export const PRIORITY_DEFAULT = 5;