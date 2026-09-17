# 规划文档 — 代码草图注释

`/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/ideas/`（`<IDEAS_ROOT>`）实现思路中的代码块仅为 **伪代码 / 接口草图**（建议 ≤30 行/块），**不要**贴大段可运行实现（完整实现属 `implementation-doc-from-diff`）。

凡出现的 JS/TS（含伪代码）围栏块，注释规则如下。

## 1. 硬约束

| 原则 | 说明 |
| ---- | ---- |
| **覆盖** | **每一行**非空、非纯花括号的源码上方须有中文注释 |
| **内容** | **「做了什么」** + **「为什么这么做」**；禁止废话（「赋值变量」「条件判断」） |
| **位置** | 注释在上一行，不是行尾 |
| **豁免** | 空行；纯 `{` / `}` / `},` / `};` / `]);` / `);` 等无表达式闭合行 |
| **禁止前缀** | 不加 `讲解：` / `说明：` |

## 2. 必须注释的行类型

import、变量声明、函数/参数行、return、if/else/switch、循环、方法调用、对象/数组每个属性行、装饰器、类型声明（`type` / `interface` 成员）。

## 3. 正确示例

```typescript
// 试跑/生成共用的会话创建入参；generate 可无 skillId 表示草稿桶
type CreateTrySessionInput = {
	// try 必须绑 Skill；generate 可选
	kind: 'try' | 'generate';
	// 已保存 Skill id；缺省则 list/create 走 skill_id IS NULL
	skillId?: string;
	// 侧栏展示标题，可空
	title?: string;
};

// 新建锚定会话：同 id 写入 agent_sessions + skill_try_sessions
function createTrySession(input: CreateTrySessionInput): { sessionId: string } {
	// … 实现阶段再填；此处只定契约
	return { sessionId: '…' };
}

// SSE 发送：生成禁 skillIds，正文用条件 intentPrefix 控 token
function sendGenerate(opts: {
	sessionId: string;
	content: string;
	intentPrefix?: string;
}): void {
	// memorySource 固定 skill_try，走业务分表
	// assistMode=skill_generate 挂生成系统提示
}
```

## 4. 与完整实现文档的边界

| | 本 Skill（ideas） | `implementation-doc-from-diff` |
|--|-------------------|--------------------------------|
| 代码量 | ≤30 行/块草图 | 完整符号 + 改动前/后成对 |
| 注释 | 同上「做什么+为什么」 | 同左，且两侧各自 100% |
| 目的 | 定契约与边界 | 归档可对照源码的改动 |

## 5. 自检

- [ ] 草图块非空非纯闭合行均有上一行注释
- [ ] 注释含做什么 + 为什么，无废话
- [ ] 单块 ≤30 行；未贴大段实现
