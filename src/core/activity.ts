/**
 * 活动系统接口定义
 */



/**
 * 活动基础接口
 */
export interface ActivityBody {
  action: string;
}

export interface Activity {
  id: string;
  // validated to be the same as faculty name
  // 我不希望Faculty之间相互保留引用，因为这会让faculty绕开活动流来交流。
  role: string; 
  timestamp: Date;
  details: ActivityBody;
}


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
export interface WakeUp extends Conscious {
  readonly __is_wake_up: true;
}

export function isWakeUp(activity: Activity): activity is WakeUp {
  return '__is_wake_up' in activity;
}

// TODO: no activity builder, validate activities at hub


