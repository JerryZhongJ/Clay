/**
 * Hub 协调器接口定义
 */

import { Activity, ActivityCondition, ActivityFilter, ActivityHandler } from './activity';
import { Faculty } from './faculty';


/**
 * Hub 协调器接口
 */
export interface Hub {
  /**
   * 注册 Faculty
   */
  connectFaculty(faculty: Faculty): void;

  /**
   * 注销 Faculty
   */
  disconnectFaculty(facultyName: string): void;

  /**
   * 注册活动处理器
   */
  registerActivityHandler(filter: ActivityFilter, handler: ActivityHandler): void;

  registerActivityHandler(condition: ActivityCondition, handler: ActivityHandler): void;
  /**
   * 注销活动处理器 - 通过 handler 注销
   */
  unregisterActivityHandler(handler: ActivityHandler): void;

  /**
   * 添加活动到活动流
   */
  appendActivity(activity: Activity): void;

  /**
   * 获取 Faculty 列表
   */
  getFaculties(): Faculty[];

  /**
   * 启动 Hub
   */
  resume(): Promise<void>;

  /**
   * 停止 Hub
   */
  stop(): Promise<void>;

}

export { ActivityFilter, ActivityHandler };

