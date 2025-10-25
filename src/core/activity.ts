/**
 * 活动系统接口定义
 */

import { Faculty } from "./faculty";


/**
 * 活动基础接口
 */

export interface Activity {
  id: string;
  // validated to be the same as faculty name
  // 我不希望Faculty之间相互保留引用，因为这会让faculty绕开活动流来交流。
  // Activity作为交流的媒介，用name来标识Faculty。
  faculty_name: string; 
  verb: string;
  timestamp: Date;
  tags: Set<ActivityTag>;
}

export enum ActivityTag {
    CONSCIOUS = 'conscious',
    WAKE_UP = 'wake_up',
  }
/**
 * 活动类型标记接口
 */

/** 潜意识活动 - 不出现在注意域中 */
export interface Conscious extends Activity {
  readonly __is_conscious: true;
  priority: number; // 0-9，9最高
  readable(): string;
}

export function isConscious(activity: Activity): activity is Conscious {
  return '__is_conscious' in activity;
}

/** 唤醒活动 - 当系统沉睡时，此类活动会将系统唤醒 */
export interface WakeUp extends Activity {
  readonly __is_wake_up: true;
}

export function isWakeUp(activity: Activity): activity is WakeUp {
  return '__is_wake_up' in activity;
}

// TODO: no activity builder, validate activities at hub

/**
 * 活动过滤器接口
 */
export type ActivityFilter = (activity: Activity) => boolean;
export type ActivityCondition = {
  facultyName?: string;
  verb?: string;
  tags?: Set<ActivityTag>;
}
/**
 * 活动处理器接口
 */
export interface ActivityHandler {
  faculty: Faculty;
  description: string;
  handle(activity: Activity): Promise<void>;
}

