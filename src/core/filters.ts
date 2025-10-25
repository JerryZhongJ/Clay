/**
 * 活动过滤器实现
 */

import { Activity, Conscious } from './activity';
import { ActivityFilter } from './hub';

/**
 * 通用活动过滤器
 * 支持按 faculty_name、verb、priority 进行过滤
 */
export class CommonActivityFilter implements ActivityFilter {
  constructor(
    private options: {
      faculty_name?: string | string[];
      verb?: string | string[];
      minPriority?: number;
      maxPriority?: number;
      custom?: (activity: Activity) => boolean;
    } = {}
  ) {}

  match(activity: Activity): boolean {
    // 检查 faculty_name
    if (this.options.faculty_name !== undefined) {
      const facultyNames = Array.isArray(this.options.faculty_name)
        ? this.options.faculty_name
        : [this.options.faculty_name];
      if (!facultyNames.includes(activity.faculty_name)) {
        return false;
      }
    }

    // 检查 verb
    if (this.options.verb !== undefined) {
      const verbs = Array.isArray(this.options.verb) ? this.options.verb : [this.options.verb];
      if (!verbs.includes(activity.verb)) {
        return false;
      }
    }

    // 检查优先级（仅对 Conscious 活动有效）
    if (this.isConscious(activity)) {
      if (this.options.minPriority !== undefined && activity.priority < this.options.minPriority) {
        return false;
      }
      if (this.options.maxPriority !== undefined && activity.priority > this.options.maxPriority) {
        return false;
      }
    }

    // 自定义匹配函数
    if (this.options.custom !== undefined) {
      return this.options.custom(activity);
    }

    return true;
  }

  private isConscious(activity: Activity): activity is Conscious {
    return '__is_conscious' in activity;
  }
}

/**
 * 匹配所有活动的过滤器
 */
export class AllActivityFilter implements ActivityFilter {
  match(_activity: Activity): boolean {
    return true;
  }
}

/**
 * Faculty 名称过滤器
 */
export class FacultyNameFilter implements ActivityFilter {
  constructor(private facultyName: string | string[]) {}

  match(activity: Activity): boolean {
    const names = Array.isArray(this.facultyName) ? this.facultyName : [this.facultyName];
    return names.includes(activity.faculty_name);
  }
}

/**
 * Verb 过滤器
 */
export class VerbFilter implements ActivityFilter {
  constructor(private verb: string | string[]) {}

  match(activity: Activity): boolean {
    const verbs = Array.isArray(this.verb) ? this.verb : [this.verb];
    return verbs.includes(activity.verb);
  }
}

/**
 * 优先级范围过滤器（仅匹配 Conscious 活动）
 */
export class PriorityRangeFilter implements ActivityFilter {
  constructor(
    private minPriority?: number,
    private maxPriority?: number
  ) {}

  match(activity: Activity): boolean {
    if (!this.isConscious(activity)) {
      return false;
    }

    if (this.minPriority !== undefined && activity.priority < this.minPriority) {
      return false;
    }

    if (this.maxPriority !== undefined && activity.priority > this.maxPriority) {
      return false;
    }

    return true;
  }

  private isConscious(activity: Activity): activity is Conscious {
    return '__is_conscious' in activity;
  }
}

/**
 * Conscious 活动过滤器（仅匹配有意识活动）
 */
export class ConsciousActivityFilter implements ActivityFilter {
  match(activity: Activity): boolean {
    return '__is_conscious' in activity;
  }
}

/**
 * WakeUp 活动过滤器（仅匹配唤醒活动）
 */
export class WakeUpActivityFilter implements ActivityFilter {
  match(activity: Activity): boolean {
    return '__is_wake_up' in activity;
  }
}

/**
 * 组合过滤器 - AND 逻辑
 */
export class AndFilter implements ActivityFilter {
  constructor(private filters: ActivityFilter[]) {}

  match(activity: Activity): boolean {
    return this.filters.every(filter => filter.match(activity));
  }
}

/**
 * 组合过滤器 - OR 逻辑
 */
export class OrFilter implements ActivityFilter {
  constructor(private filters: ActivityFilter[]) {}

  match(activity: Activity): boolean {
    return this.filters.some(filter => filter.match(activity));
  }
}

/**
 * 取反过滤器
 */
export class NotFilter implements ActivityFilter {
  constructor(private filter: ActivityFilter) {}

  match(activity: Activity): boolean {
    return !this.filter.match(activity);
  }
}

/**
 * 自定义函数过滤器
 */
export class CustomFilter implements ActivityFilter {
  constructor(private predicate: (activity: Activity) => boolean) {}

  match(activity: Activity): boolean {
    return this.predicate(activity);
  }
}
