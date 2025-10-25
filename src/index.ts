/**
 * Clay AI Assistant 主入口文件
 * 具有自主性和持续存在感的 AI 助手
 */

export * from './core/types';
export * from './core/activity';
export * from './core/faculty';
export * from './core/hub';

export * from './faculties/attentionfield';
export * from './faculties/mind';
export * from './faculties/memory';
export * from './faculties/terminal';
export * from './faculties/clock';
export * from './faculties/internet';

export * from './infrastructure/controlpanel';
export * from './infrastructure/bootstrap';

export * from './config/types';

/**
 * Clay AI Assistant 版本信息
 */
export const VERSION = '0.1.0';

/**
 * 项目描述
 */
export const DESCRIPTION = '具有自主性和持续存在感的 AI 助手';

/**
 * 启动 Clay AI Assistant
 */
export async function startClay(): Promise<void> {
  console.log(`🚀 启动 ${DESCRIPTION} v${VERSION}`);
  console.log('📚 项目文档: ./docs/overview.md');
  console.log('💡 这是一个框架实现，具体功能需要进一步开发');
}

/**
 * 停止 Clay AI Assistant
 */
export async function stopClay(): Promise<void> {
  console.log('🛑 停止 Clay AI Assistant');
}

// 如果直接运行此文件，则启动系统
if (require.main === module) {
  startClay().catch(console.error);
}