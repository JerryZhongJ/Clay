/**
 * Hub 协调器接口定义
 */

import { Activity, ActivityBody } from './activity';
import { Faculty } from './faculty';

export type ActivityHandle = (activity: Activity) => Promise<void>;

/**
 * Hub 协调器接口
 */
export interface Hub {
  /**
   * 注册 Faculty
   */
  connectFaculty(role:string, faculty: Faculty): void;

  /**
   * 注销 Faculty
   */
  disconnectFaculty(role: string): void;

  /**
   * 注册活动处理器
   */
  registerActivityHandler(handler: ActivityHandler): void;

  /**
   * 注销活动处理器 - 通过 handler 注销
   */
  unregisterActivityHandler( handler: ActivityHandler): void;

  unregisterAllActivityHandler(role: string): void;
  
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
export interface ActivityHandler {
  condition: ActivityMask | ActivityFilter;
  role: string;
  description: string;
  handle(activity: Activity): Promise<void>;
}
export type ActivityFilter = (activity: Activity) => boolean;
export type ActivityMask = {
  role?: string;
  verb?: string;
}
export interface HubPort {
  readonly role: string;
  readonly hub: Hub;
  readonly faculty: Faculty;
  appendActivity(activity_body: ActivityBody): void;
  registerActivityHandler(condition: ActivityMask | ActivityFilter, handle: ActivityHandle, description: string): void;
  unregisterActivityHandler(handle: ActivityHandle): void;
  unregisterActivityHandler(filter: ActivityFilter): void;
  unregisterActivityHandler(condition: ActivityMask): void;
  unregisterAllHandlers(): void;
}

