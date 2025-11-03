/**
 * Hub 协调器实现
 */

import type { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { Activity } from './activity';
import { Faculty } from './faculty';
import { ActivityFilter, ActivityHandler, ActivityMask, Hub } from './hub';
import { HubPortImpl } from './hub-port-impl';

/**
 * 活动处理器注册项
 */


/**
 * Hub 实现类
 */
export class HubImpl implements Hub {
  private faculties: Map<string, Faculty> = new Map();
  private running: boolean = false;
  // private handlers: ActivityHandler[] = [];
  private handlers_of_role: Map<string, Set<ActivityHandler>> = new Map();
  private all_handlers: Set<ActivityHandler> = new Set();
  // TODO: 按role管理注册
  // TODO: 按具体的condition管理注册
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('Hub');
  }

  /**
   * 注册 Faculty
   */
  connectFaculty(role:string, faculty: Faculty): void {
    if (this.faculties.has(role)) {
      this.logger.warn(`职位 ${role} 已经被占用了`);
      return;
    }

    this.faculties.set(role, faculty);

    // 注入 Hub 引用给 Faculty
    faculty.setHub(new HubPortImpl(role, this, faculty));

    this.logger.info(`Faculty ${role} 已注册`);
  }

  /**
   * 注销 Faculty
   */
  disconnectFaculty(role: string): void {
    const faculty = this.faculties.get(role);
    if (!faculty) {
      this.logger.warn(`Faculty ${role} 不存在`);
      return;
    }

    // 取消 Hub 引用
    faculty.unsetHub();

    this.faculties.delete(role);

    // 移除相关的活动处理器
    this.unregisterAllActivityHandler(role);

    this.logger.info(`Faculty ${role} 已注销`);
  }

  /**
   * 注册活动处理器（支持 Filter 或 Condition）
   */
  registerActivityHandler(handler: ActivityHandler): void {
    let handlers: Set<ActivityHandler> = new Set();
    if (!this.handlers_of_role.has(handler.role)) {
      this.handlers_of_role.set(handler.role, handlers);
    } else {
      handlers = this.handlers_of_role.get(handler.role)!;
    }
    handlers.add(handler);
    this.all_handlers.add(handler);
    this.logger.debug(`注册活动处理器: ${handler.description}`);
  }

  /**
   * 注销活动处理器
   */
  unregisterActivityHandler(handler: ActivityHandler): void {
    this.handlers_of_role.get(handler.role)?.delete(handler);
    this.all_handlers.delete(handler);
    this.logger.debug(`注销活动处理器: ${handler.description}`);
  }

  unregisterAllActivityHandler(role: string): void {
    const handlers = this.handlers_of_role.get(role);
    if (handlers) {
      handlers.forEach(handler => {
        this.all_handlers.delete(handler);
        this.logger.debug(`注销活动处理器: ${handler.description}`);
      });
    }
    this.handlers_of_role.delete(role);
  }

  /**
   * 添加活动到活动流
   */
  appendActivity(activity: Activity): void {
    if (!this.running) {  
      this.logger.warn('Hub 尚未启动');
      return;
    }

    // 验证活动的 faculty_name 是否有效
    if (!this.faculties.has(activity.role)) {
      this.logger.warn(`活动来自未注册的 Faculty: ${activity.role}`);
    }


    this.logger.debug(`活动已添加: ${activity.role}.${activity.details.action}`);

    // 触发匹配的活动处理器
    this.triggerHandlers(activity);
  }

  /**
   * 触发匹配的活动处理器（并发执行）
   * @returns 所有 handler 的 Promise 数组
   */
  private triggerHandlers(activity: Activity): Promise<void>[] {
    // 1. 先收集所有匹配的 handlers
    const matchedHandlers: ActivityHandler[] = Array.from(this.all_handlers).filter(handler => {
      let isMatch = false;

      if (typeof handler.condition === 'function') {
        // 使用 ActivityFilter 匹配
        let filter = handler.condition as ActivityFilter;
        isMatch = filter(activity);
      } else {
        // 使用 ActivityCondition 匹配
        let condition = handler.condition as ActivityMask;
        isMatch = this.matchCondition(activity, condition);
      }

      return isMatch;
    });


    // 2. 返回所有 handler 的 Promise
    return matchedHandlers.map(handler => {
      this.logger.debug(`触发处理器: ${handler.description}`);

      return handler.handle(activity).catch((error: any) => {
        this.logger.error(`处理器执行失败: ${handler.description}`, {
          error: error instanceof Error ? error.message : String(error),
          handler: handler.description,
          activity: `${activity.role}.${activity.details.action}`
        });
      });
    });
  }

  /**
   * 根据 ActivityCondition 匹配活动
   */
  private matchCondition(activity: Activity, condition: ActivityMask): boolean {
    // 匹配 role
    if (condition.role !== undefined && activity.role !== condition.role) {
      return false;
    }

    // 匹配 verb
    if (condition.verb !== undefined && activity.details.action !== condition.verb) {
      return false;
    }

    return true;
  }

  /**
   * 获取 Faculty 列表
   */
  getFaculties(): Faculty[] {
    return Array.from(this.faculties.values());
  }



  /**
   * 启动 Hub
   */
  async resume(): Promise<void> {
    if (this.running) {
      this.logger.warn('Hub 已经在运行中');
      return;
    }

    this.logger.info('Hub 启动中...');
    this.running = true;
  }

  /**
   * 停止 Hub
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Hub 已经停止');
      return;
    }

    this.logger.info('Hub 停止中...');
    this.running = false;
  }

}

