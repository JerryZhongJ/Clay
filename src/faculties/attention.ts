/**
 * Attention Faculty 实现
 * 负责管理注意域，控制活动准入
 */

import { MaxPriorityQueue } from '@datastructures-js/priority-queue';
import type { Logger } from 'winston';
import { Activity, ActivityBody, Conscious, isConscious } from '../core/activity';
import { Faculty } from '../core/faculty';
import { HubPort } from '../core/hub';
import { createLogger } from '../utils/logger';

/**
 * 注意域条目 - Conscious 活动的截断表示
 */
interface AttentionEntry {
  readonly role: string;
  readonly timestamp: Date;
  readonly priority: number;
  readonly content: string; 
}



/**
 * 注意域清空活动体
 */
interface AttentionClearedBody extends ActivityBody {
  action: 'cleared';
  clearedEntries: AttentionEntry[];  // 被清空的注意域条目列表
  clearedCount: number;              // 被清空的条目数量
  totalCount: number;                // 清空前的总条目数量
  clearedSize: number;               // 被清空的总字符数
  remainingSize: number;             // 剩余字符数
}

/**
 * 注意域清空活动（潜意识活动，不进入注意域）
 */
interface AttentionCleared extends Activity {
  details: AttentionClearedBody;
}

/**
 * 判断是否为注意域清空活动。
 * 注意它只检查当前Faculty产生的活动，对于其他Faculty产生的活动可能误判。使用之前请确认活动的来源。
 */
function isAttentionCleared(activity: Activity): activity is AttentionCleared {
  return activity.details.action === 'cleared';
}

/**
 * 注意域添加活动体
 */
interface AttentionAddBody extends ActivityBody {
  action: 'add';
  addedEntries: AttentionEntry[];      // 新添加的注意域条目
  attentionField: AttentionEntry[];    // 整个注意域中的所有条目
  currentSize: number;                 // 当前注意域大小
  maxSize: number;                     // 最大容量
  usage: number;                       // 使用率（0-1）
}

/**
 * 注意域添加活动（潜意识活动，不进入注意域）
 */
interface AttentionAdd extends Activity {
  details: AttentionAddBody;
}

/*
  * 判断是否为注意域添加活动。
  * 注意它只检查当前Faculty产生的活动，对于其他Faculty产生的活动可能误判。使用之前请确认活动的来源。
  *
 */
function isAttentionAdd(activity: Activity): activity is AttentionAdd {
  return activity.details.action === 'add';
}
/**
 * 注意域配置
 */
interface AttentionConfig {
  maxSize: number;           // 最大容量（字符数）
  clearPercentage: number;   // 清空百分比（0-1）
  reaction_time: number;              // 反应时间（毫秒），收集一轮有意识活动所需的时间。
                                      // 最坏情况，一个活动从产生要经过这个长度的时间才能被注意到。
  size_per_second: number;   // 活动密度（字符数/反应时间），单位时间可添加的活动量
  max_entry_length: number; // 单个注意域条目的最大长度（字符数）

}

const defaultConfig: AttentionConfig ={
      maxSize: 10000,
      clearPercentage: 0.5,
      reaction_time: 200,              // 默认 200 毫秒
  size_per_second: 500, // 默认每秒 500 字符
  max_entry_length: 1000
};


/**
 * Attention Faculty 类
 */
class Attention implements Faculty {
  readonly name = 'attention';

  private hubPort?: HubPort | undefined;
  private logger: Logger;
  private config: AttentionConfig;
  private focuses: Map<string, number> = new Map();
  private attentionField: AttentionEntry[] = [];
  private currentSize: number = 0;

  // 按 role 分类的活动优先队列（MaxPriorityQueue 按优先级从高到低）
  private pendingActivitiesByRole: Map<string, MaxPriorityQueue<AttentionEntry>> = new Map();
  private paceTimer?: NodeJS.Timeout | undefined;

  constructor(config: AttentionConfig, logger?: Logger) {
    this.logger = logger ?? createLogger('Attention');
    this.config = config;
  }

  /**
   * 设置 Hub 引用
   */
  setHub(hubPort: HubPort): void {
    this.hubPort = hubPort;
    this.logger.info('Hub 已设置');
  }

  /**
   * 取消 Hub 引用
   */
  unsetHub(): void {
    this.hubPort = undefined;
    this.logger.info('Hub 已取消');
  }

  /**
   * 启动 Attention
   */
  async start(): Promise<void> {
    if (!this.hubPort) {
      throw new Error('Hub 未设置，无法启动');
    }

    this.logger.info('Attention 启动中...');

    // 注册活动处理器：监听所有 Conscious 活动
    this.hubPort.registerActivityHandler(
      isConscious,
      async (activity: Activity) => {
        await this.handleConsciousActivity(activity as Conscious);
      },
      'Attention: 处理 Conscious 活动'
    );

    // 启动定时器，按 pace 节奏处理积攒的活动
    this.startPaceTimer();

    this.logger.info('Attention 启动完成');
  }

  /**
   * 停止 Attention
   */
  async stop(): Promise<void> {
    this.logger.info('Attention 停止中...');

    // 停止定时器
    this.stopPaceTimer();

    this.attentionField = [];
    this.pendingActivitiesByRole.clear();
    this.currentSize = 0;
    this.logger.info('Attention 停止完成');
  }

  /**
   * 休眠 Attention
   */
  async sleep(): Promise<void> {
    this.logger.info('Attention 进入休眠');
  }

  /**
   * 唤醒 Attention
   */
  async wakeUp(): Promise<void> {
    this.logger.info('Attention 已唤醒');
  }
  private consciousToEntry(activity: Conscious): AttentionEntry | undefined {
    let content: string;
    try {
      content = activity.readable();
    } catch (error) {
      return undefined;
    }

    // 检查是否需要截断
    if (content.length > this.config.max_entry_length) {
      content = content.substring(0, this.config.max_entry_length - 3) + '...';
    }

    return {
      role: activity.role,
      timestamp: activity.timestamp,
      priority: activity.priority,
      content
    };
  }




  /**
   * 处理 Conscious 活动（转换为 AttentionEntry 并按 role 积攒到优先队列）
   */
  private async handleConsciousActivity(activity: Conscious): Promise<void> {
    // 转换为 AttentionEntry
    const entry = this.consciousToEntry(activity);
    if (!entry) {
      this.logger.warn('无法转换 Conscious 活动为 AttentionEntry，已忽略');
      return;
    }
    const role = entry.role;

    // 获取或创建该 role 的优先队列
    if (!this.pendingActivitiesByRole.has(role)) {
      // MaxPriorityQueue 需要比较函数，按 priority 从高到低排序
      const queue = new MaxPriorityQueue<AttentionEntry>((a) => a.priority);
      this.pendingActivitiesByRole.set(role, queue);
    }

    const queue = this.pendingActivitiesByRole.get(role)!;
    queue.enqueue(entry);

    this.logger.debug(
      `活动已转换并加入 ${role} 优先队列, ` +
      `优先级: ${entry.priority}, ` +
      `content长度: ${entry.content.length}, ` +
      `队列长度: ${queue.size()}`
    );
  }

  /**
   * 计算活动大小（字符数）
   */

  /**
   * 清空注意域
   */
  private async clearAttentionField(): Promise<void> {
    const clearCount = Math.floor(this.attentionField.length * this.config.clearPercentage);

    if (clearCount === 0) {
      return;
    }

    const totalCount = this.attentionField.length;
    this.logger.info(`清空注意域: 移除 ${clearCount}/${totalCount} 个条目`);

    // FIFO：移除最早的条目
    const clearedEntries = this.attentionField.splice(0, clearCount);

    // 计算被清空的条目总大小
    const clearedSize = clearedEntries.reduce(
      (sum, entry) => sum + entry.content.length,
      0
    );

    // 重新计算剩余大小
    this.currentSize = this.attentionField.reduce(
      (sum, entry) => sum + entry.content.length,
      0
    );

    // 产生清空活动（供 Memory 持久化）
    if (this.hubPort) {
      const clearedBody: AttentionClearedBody = {
        action: 'cleared',
        clearedEntries,
        clearedCount: clearCount,
        totalCount,
        clearedSize,
        remainingSize: this.currentSize
      };

      this.hubPort.appendActivity(clearedBody);
      this.logger.debug(`已发送清空活动: ${clearCount} 个活动被清空`);
    }
  }

  /**
   * 设置 Faculty 的 focus 值
   */
  setFacultyFocus(facultyName: string, focus: number): void {
    if (focus < 0 || focus > 1) {
      throw new Error('focus 值必须在 0-1 之间');
    }
    this.focuses.set(facultyName, focus);
    this.logger.debug(`设置 Faculty focus: ${facultyName} = ${focus}`);
  }

  /**
   * 获取 Faculty 的 focus 值
   */
  getFacultyFocus(role: string): number {
    return this.focuses.get(role) ?? 1; // 默认 1
  }


  /**
   * 启动 pace 定时器
   */
  private startPaceTimer(): void {
    if (this.paceTimer) {
      return;
    }

    this.paceTimer = setInterval(() => {
      this.processPendingActivities();
    }, this.config.reaction_time);

    this.logger.debug(`Pace 定时器已启动: ${this.config.reaction_time}ms`);
  }

  /**
   * 停止 pace 定时器
   */
  private stopPaceTimer(): void {
    if (this.paceTimer) {
      clearInterval(this.paceTimer);
      this.paceTimer = undefined;
      this.logger.debug('Pace 定时器已停止');
    }
  }

  /**
   * 处理积攒的活动
   * 按 focus 分配空间，每个 role 按优先级筛选活动
   */
  private async processPendingActivities(): Promise<void> {

    // 统计总的待处理活动数
    let totalPending = 0;
    for (const queue of this.pendingActivitiesByRole.values()) {
      totalPending += queue.size();
    }

    this.logger.debug(`开始处理待处理条目: ${totalPending} 个，分布在 ${this.pendingActivitiesByRole.size} 个 role`);

    // 1. 计算本次可添加的最大字符数
    const maxAddSize = this.config.size_per_second * (this.config.reaction_time / 1000);

    // 2. 计算所有条目的总大小
    const allEntriesByRole = new Map<string, AttentionEntry[]>();
    let totalSize = 0;

    for (const [role, queue] of this.pendingActivitiesByRole.entries()) {
      const entries: AttentionEntry[] = [];
      // 从优先队列中取出所有条目（已按优先级排序）
      while (!queue.isEmpty()) {
        const entry = queue.dequeue();
        if (entry) {
          entries.push(entry);
        }
      }
      allEntriesByRole.set(role, entries);

      // 计算该 role 的总大小
      for (const entry of entries) {
        totalSize += entry.content.length;
      }
    }

    // 3. 判断是否需要按 focus 分配
    const toAdd: AttentionEntry[] = [];

    if (totalSize <= maxAddSize) {
      // 所有条目都可以添加
      this.logger.debug(`所有条目可添加: 总大小 ${totalSize} <= 最大值 ${maxAddSize}`);

      for (const entries of allEntriesByRole.values()) {
        toAdd.push(...entries);
      }
    } else {
      // 需要按 focus 分配空间
      this.logger.debug(`需要按 focus 分配: 总大小 ${totalSize} > 最大值 ${maxAddSize}`);

      // 计算总 focus
      let totalFocus = 0;
      for (const role of allEntriesByRole.keys()) {
        totalFocus += this.getFacultyFocus(role);
      }

      // 按 focus 比例分配空间给每个 role
      for (const [role, entries] of allEntriesByRole.entries()) {
        const roleFocus = this.getFacultyFocus(role);
        const roleMaxSize = Math.floor(maxAddSize * (roleFocus / totalFocus));

        this.logger.debug(
          `${role}: focus=${roleFocus}, 分配空间=${roleMaxSize} 字符 ` +
          `(${(roleFocus / totalFocus * 100).toFixed(1)}%)`
        );

        // 从该 role 的条目中按优先级选择，直到达到分配的最大值
        let roleAddedSize = 0;
        for (const entry of entries) {
          const entrySize = entry.content.length;

          if (roleAddedSize + entrySize <= roleMaxSize) {
            toAdd.push(entry);
            roleAddedSize += entrySize;
          } else {
            // 超出该 role 的分配空间，放回队列等待下次处理
            const queue = this.pendingActivitiesByRole.get(role)!;
            queue.enqueue(entry);
          }
        }

        this.logger.debug(`${role}: 选中 ${toAdd.filter(e => e.role === role).length} 个条目，大小 ${roleAddedSize} 字符`);
      }
    }

    // 4. 计算实际添加的总大小
    const addedSize = toAdd.reduce((sum, e) => sum + e.content.length, 0);

    // 5. 按 timestamp 排序（时间早的在前）
    toAdd.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 6. 检查是否需要清空注意域
    if (this.currentSize + addedSize > this.config.maxSize) {
      await this.clearAttentionField();
    }

    // 7. 添加到注意域
    this.attentionField.push(...toAdd);
    this.currentSize += addedSize;

    this.logger.debug(
      `已添加 ${toAdd.length} 个条目到注意域，大小: ${addedSize} 字符，` +
      `当前大小: ${this.currentSize}/${this.config.maxSize}`
    );

    // 8. 发送 AttentionAdd 活动
    if (this.hubPort) {
      const addBody: AttentionAddBody = {
        action: 'add',
        addedEntries: toAdd,
        attentionField: [...this.attentionField],  // 复制整个注意域
        currentSize: this.currentSize,
        maxSize: this.config.maxSize,
        usage: this.currentSize / this.config.maxSize
      };

      this.hubPort.appendActivity(addBody);
      this.logger.debug(`已发送 AttentionAdd 活动`);
    }
  }
}

// ==================== 导出 ====================

// Faculty 类
export { Attention };

// 配置
  export type { AttentionConfig };

// 默认配置
  export { defaultConfig };

// 其他类型
  export type {
    AttentionAdd, AttentionAddBody, AttentionCleared, AttentionClearedBody, AttentionEntry
  };

  export {
    isAttentionAdd, isAttentionCleared
  };

