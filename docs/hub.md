# Hub 协调器

## 概述

Hub 是系统的核心协调者（不再是 Faculty），负责整个 AI 助手的运行协调和 Faculty 管理。

## 核心职责

- **管理 Faculty 注册和活动路由**
- **协调 Faculty 间的交互**
- **管理 AI 助手的运行状态**
- **调用 Faculty 的标准接口方法（如休眠）**
- **错误处理**：捕获 Faculty 调用异常，防止单个 Faculty 错误影响整个系统

## 管理其他 Faculty

- 其他 Faculty 需要注册在 Hub 中
- Faculty 可以注册特定条件的活动处理
- 当遇到特定活动时，Hub 调用相应功能
- 其他 Faculty 向 Hub append 活动，Hub 则直接调用这些 Faculty 的功能（不是发送活动）

## 活动响应机制

当活动流出现被注册的活动时，Hub 需要响应并调用相应功能。

## 调用机制设计说明

- **Faculty→Hub**：使用活动机制，符合事件流式组织理念
- **Hub→Faculty**：使用直接调用，Hub 作为协调器需要直接控制 Faculty 行为
- **调用特性**：异步调用，无返回值，Faculty 通过产生新活动来"返回"结果
- **错误处理**：Hub 捕获 Faculty 调用异常，防止单个 Faculty 错误影响整个系统（错误记录到日志，不进入活动流）