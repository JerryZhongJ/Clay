/**
 * Hub 协调器实现
 */

import type { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { Activity, ActivityCondition } from './activity';
import { Faculty } from './faculty';
import { ActivityFilter, ActivityHandler, Hub } from './hub';

/**
 * 活动处理器注册项
 */
interface HandlerRegistration {
  filter?: ActivityFilter;
  condition?: ActivityCondition;
  handler: ActivityHandler;
}

/**
 * Hub 实现类
 */
export class HubImpl implements Hub {
  private faculties: Map<string, Faculty> = new Map();
  private running: boolean = false;
  private handlerRegistrations: HandlerRegistration[] = [];
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('Hub');
  }

  /**
   * 注册 Faculty
   */
  connectFaculty(faculty: Faculty): void {
    if (this.faculties.has(faculty.name)) {
      this.logger.warn(`Faculty ${faculty.name} 已经注册过了`);
      return;
    }

    this.faculties.set(faculty.name, faculty);

    // 注入 Hub 引用给 Faculty
    faculty.setHub(this);

    this.logger.info(`Faculty ${faculty.name} 已注册`);
  }

  /**
   * 注销 Faculty
   */
  disconnectFaculty(facultyName: string): void {
    const faculty = this.faculties.get(facultyName);
    if (!faculty) {
      this.logger.warn(`Faculty ${facultyName} 不存在`);
      return;
    }

    // 取消 Hub 引用
    faculty.unsetHub();

    this.faculties.delete(facultyName);

    // 移除相关的活动处理器
    this.handlerRegistrations = this.handlerRegistrations.filter(
      reg => reg.handler.faculty.name !== facultyName
    );

    this.logger.info(`Faculty ${facultyName} 已注销`);
  }

  /**
   * 注册活动处理器（支持 Filter 或 Condition）
   */
  registerActivityHandler(filterOrCondition: ActivityFilter | ActivityCondition, handler: ActivityHandler): void {
    // 判断是 Filter 还是 Condition
    if (typeof (filterOrCondition) === 'function' ) {
      // ActivityFilter 有 match 方法
      this.handlerRegistrations.push({ filter: filterOrCondition, handler });
    } else {
      // ActivityCondition 是简单对象
      this.handlerRegistrations.push({ condition: filterOrCondition, handler });
    }
    this.logger.debug(`注册活动处理器: ${handler.description}`);
  }

  /**
   * 注销活动处理器
   */
  unregisterActivityHandler(handlerOrFilter: ActivityHandler | ActivityFilter): void {
    if ('handle' in handlerOrFilter) {
      // 通过 handler 注销
      const handler = handlerOrFilter as ActivityHandler;
      this.handlerRegistrations = this.handlerRegistrations.filter(
        reg => reg.handler !== handler
      );
      this.logger.debug(`注销活动处理器: ${handler.description}`);
    } else {
      // 通过 filter 注销
      const filter = handlerOrFilter as ActivityFilter;
      this.handlerRegistrations = this.handlerRegistrations.filter(
        reg => reg.filter !== filter
      );
      this.logger.debug('通过 filter 注销活动处理器');
    }
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
    if (!this.faculties.has(activity.faculty_name)) {
      this.logger.warn(`活动来自未注册的 Faculty: ${activity.faculty_name}`);
    }


    this.logger.debug(`活动已添加: ${activity.faculty_name}.${activity.verb}`);

    // 触发匹配的活动处理器
    this.triggerHandlers(activity);
  }

  /**
   * 触发匹配的活动处理器（并发执行）
   * @returns 所有 handler 的 Promise 数组
   */
  private triggerHandlers(activity: Activity): Promise<void>[] {
    // 1. 先收集所有匹配的 handlers
    const matchedHandlers: ActivityHandler[] = [];

    for (const registration of this.handlerRegistrations) {
      try {
        let isMatch = false;

        if (registration.filter) {
          // 使用 ActivityFilter 匹配
          isMatch = registration.filter(activity);
        } else if (registration.condition) {
          // 使用 ActivityCondition 匹配
          isMatch = this.matchCondition(activity, registration.condition);
        }

        if (isMatch) {
          matchedHandlers.push(registration.handler);
        }
      } catch (error) {
        this.logger.error(`处理器匹配异常: ${registration.handler.description}`, {
          error: error instanceof Error ? error.message : String(error),
          faculty: registration.handler.faculty.name
        });
      }
    }

    // 2. 返回所有 handler 的 Promise
    return matchedHandlers.map(handler => {
      this.logger.debug(`触发处理器: ${handler.description}`);

      return handler.handle(activity).catch((error: any) => {
        this.logger.error(`处理器执行失败: ${handler.description}`, {
          error: error instanceof Error ? error.message : String(error),
          faculty: handler.faculty.name,
          activity: `${activity.faculty_name}.${activity.verb}`
        });
      });
    });
  }

  /**
   * 根据 ActivityCondition 匹配活动
   */
  private matchCondition(activity: Activity, condition: ActivityCondition): boolean {
    // 匹配 facultyName
    if (condition.facultyName !== undefined && activity.faculty_name !== condition.facultyName) {
      return false;
    }

    // 匹配 verb
    if (condition.verb !== undefined && activity.verb !== condition.verb) {
      return false;
    }

    // 匹配 tags
    if (condition.tags !== undefined && condition.tags.size > 0) {
      // 检查活动是否包含条件中的所有标记
      for (const tag of condition.tags) {
        if (!activity.tags.has(tag)) {
          return false; 
        }
      }
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
