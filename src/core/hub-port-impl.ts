/**
 * HubPort 实现类
 * 作为 Faculty 与 Hub 之间的接口适配器
 */

import { Activity, ActivityBody } from './activity';
import { Faculty } from './faculty';
import { ActivityFilter, ActivityHandle, ActivityHandler, ActivityMask, Hub, HubPort } from './hub';

/**
 * 活动 ID 序列计数器
 */
let activitySequence = 0;

/**
 * 生成人类可读的唯一活动 ID
 *
 * 格式: <role>-<HHMMSS>-<序列号>
 * 示例: teacher-143052-0001
 *
 * @param role - 可选的角色前缀
 * @returns 唯一的人类可读 ID
 */
function generateUniqueId(role?: string): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeStr = `${hours}${minutes}${seconds}`;

  const seq = (++activitySequence).toString().padStart(4, '0');
  const prefix = role ? role.slice(0, 10) : 'activity';

  return `${prefix}-${timeStr}-${seq}`;
}

/**
 * HubPort 实现
 *
 * 设计原则:
 * - SRP: 只负责 Faculty 与 Hub 的通信适配
 * - ISP: Faculty 通过此接口访问 Hub,隔离不必要的方法
 * - DIP: 依赖 Hub 和 Faculty 抽象,不依赖具体实现
 */
export class HubPortImpl implements HubPort {
  readonly role: string;
  readonly hub: Hub;
  readonly faculty: Faculty;

  /**
   * 存储此 Faculty 注册的所有 ActivityHandler
   * 用于批量注销和清理
   */
  private registeredHandlers: Set<ActivityHandler> = new Set();

  constructor(role: string, hub: Hub, faculty: Faculty) {
    this.role = role;
    this.hub = hub;
    this.faculty = faculty;
  }

  /**
   * 发布活动到 Hub
   */
  appendActivity(activity_body: ActivityBody): void {
    const activity: Activity = {
      id: generateUniqueId(this.role),
      role: this.role,
      details: activity_body,
      timestamp: new Date()
    };
    this.hub.appendActivity(activity);
  }

  /**
   * 注册活动处理器 (使用 Filter) 
   */
  registerActivityHandler(filter: ActivityFilter, handle: ActivityHandle, description: string): void;

  /**
   * 注册活动处理器 (使用 Condition)
   */
  registerActivityHandler(condition: ActivityMask, handle: ActivityHandle, description: string): void;

  /**
   * 注册活动处理器 (实现)
   */
  registerActivityHandler(
    condition: ActivityFilter | ActivityMask,
    handle: ActivityHandle,
    description: string
  ): void {
    // 包装 ActivityHandler
    const handler: ActivityHandler = {
      condition: condition,
      role: this.role,
      description,
      handle
    };

    // 注册到 Hub
    this.hub.registerActivityHandler(handler);

    // 保存 handler 引用,用于后续注销
    this.registeredHandlers.add(handler);
  }

  /**
   * 注销活动处理器 (通过 handle)
   */
  unregisterActivityHandler(handle: ActivityHandle): void;

  /**
   * 注销活动处理器 (通过 Filter)
   */
  unregisterActivityHandler(filter: ActivityFilter): void;

  /**
   * 注销活动处理器 (通过 Condition)
   */
  unregisterActivityHandler(condition: ActivityMask): void;

  /**
   * 注销活动处理器 (实现)
   *
   * 注意: 由于当前 HubImpl 使用数组存储,需要找到匹配的 handler 并注销
   */
  unregisterActivityHandler(
    target: ActivityHandle | ActivityFilter | ActivityMask
  ): void {
    if (typeof target === 'function') {
      // 可能是 handle 或 filter
      // 尝试作为 handle 处理
      this.unregisterByHandle(target as ActivityHandle);
    } else if (typeof target === 'object') {
      // ActivityCondition
      this.unregisterByCondition(target);
    }
  }

  /**
   * 通过 handle 注销
   */
  private unregisterByHandle(handle: ActivityHandle): void {
    // 查找匹配的 handler
    for (const handler of this.registeredHandlers) {
      if (handler.handle === handle) {
        // 注意: 这里需要遍历所有可能的 filterOrCondition
        // 由于我们不知道原始的 filterOrCondition,这是一个局限性
        // 简化方案: 直接从集合中移除
        this.registeredHandlers.delete(handler);
        // TODO: 需要 HubImpl 提供通过 handler 对象注销的方法
        break;
      }
    }
  }

  /**
   * 通过 filter 注销
   */
  private unregisterByFilter(filter: ActivityFilter): void {
    // 遍历所有注册的 handlers,找到使用此 filter 的
    for (const handler of this.registeredHandlers) {
      // 调用 Hub 的注销方法
      // 注意: 需要传入原始的 filter
      // 由于我们没有保存原始 filter,这里有局限性
      // TODO: 需要改进数据结构来保存 filter 引用
    }
  }

  /**
   * 通过 condition 注销
   */
  private unregisterByCondition(condition: ActivityMask): void {
    // 查找匹配的 handlers
    for (const handler of this.registeredHandlers) {
      // 调用 Hub 的注销方法
      // TODO: 需要保存原始的 condition 引用
    }
  }

  /**
   * 注销此 Faculty 的所有处理器
   */
  unregisterAllHandlers(): void {
    // 遍历所有注册的 handlers 并注销
    // 由于 HubImpl 的 disconnectFaculty 会自动清理,
    // 这里主要是清理本地引用
    this.registeredHandlers.clear();
  }

  /**
   * 清理资源 (Faculty 断开连接时调用)
   */
  dispose(): void {
    this.unregisterAllHandlers();
  }
}
