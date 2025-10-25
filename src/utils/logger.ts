/**
 * 日志工具 - 基于 winston
 */

import winston from 'winston';

/**
 * 创建 Logger 实例
 */
export function createLogger(label: string = 'App'): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(
      winston.format.label({ label }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'clay-ai' },
    transports: [
      // 控制台输出 - 带颜色和格式化
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, label, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${label}] ${level}: ${message}${metaStr}`;
          })
        )
      }),
      // 文件输出 - 所有日志
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      // 文件输出 - 仅错误
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ]
  });
}

/**
 * 默认 Logger 实例
 */
export const defaultLogger = createLogger('Clay');

/**
 * 导出 winston 以供直接使用
 */
export { winston };
