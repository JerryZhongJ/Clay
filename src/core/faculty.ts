/**
 * Faculty 基础接口定义
 */

import { HubPort } from "./hub";



/**
 * Faculty 基础接口
 */
export interface Faculty {
  /**
   * Faculty 名称
   */
  readonly name: string;

  /**
   * 设置 Hub
   */
  setHub(hubPort: HubPort): void;

  unsetHub(): void;

  /**
   * 启动 Faculty
   */
  start(): Promise<void>;

  /**
   * 停止 Faculty
   */
  stop(): Promise<void>;

  /**
   * 休眠 Faculty
   */
  sleep(): Promise<void>;

  /**
   * 唤醒 Faculty
   */
  wakeUp(): Promise<void>;
}