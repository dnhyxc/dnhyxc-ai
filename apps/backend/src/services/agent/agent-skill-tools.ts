import { randomUUID } from 'node:crypto';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import type { SkillBody } from '../skill/skill.service';

export function formatSkillToolResult(skill: SkillBody): string {
	return `### Skill: ${skill.title}\n${skill.content}`;
}

/** 仅允许对本轮已加载 ID 调用；返回该 Skill 正文 */
export function buildAgentSkillTools(skills: SkillBody[]): DynamicTool[] {
	if (!skills.length) return [];
	const byId = new Map(skills.map((s) => [s.id, s]));
	const catalog = skills.map((s) => `- ${s.id}: ${s.title}`).join('\n');
	return [
		new DynamicTool({
			name: 'apply_skill',
			description:
				'应用本轮已启用的 Skill 指令正文。' +
				`本轮可用 Skill：\n${catalog}\n` +
				'入参为 skill id（UUID）。系统已预置加载时通常无需再调；若需重读可再调。',
			func: async (input: string) => {
				let id = String(input ?? '').trim();
				try {
					const parsed = JSON.parse(id) as { input?: string; id?: string };
					id = String(parsed.input ?? parsed.id ?? id).trim();
				} catch {
					/* plain id */
				}
				const skill = byId.get(id);
				if (!skill) {
					return `错误：skill id 不在本轮已启用集合中：${id}`;
				}
				return formatSkillToolResult(skill);
			},
		}),
	];
}

/** 为每个已加载 Skill 预置 AIMessage(tool_calls)+ToolMessage，保证指定必加载 */
export function preseedApplySkillMessages(
	skills: SkillBody[],
): Array<AIMessage | ToolMessage> {
	const out: Array<AIMessage | ToolMessage> = [];
	for (const skill of skills) {
		const toolCallId = `skill_preseed_${randomUUID()}`;
		out.push(
			new AIMessage({
				content: '',
				tool_calls: [
					{
						id: toolCallId,
						name: 'apply_skill',
						args: { input: skill.id },
					},
				],
			}),
		);
		out.push(
			new ToolMessage({
				tool_call_id: toolCallId,
				content: formatSkillToolResult(skill),
				name: 'apply_skill',
			}),
		);
	}
	return out;
}

export function formatSkillsSystemAppend(skills: SkillBody[]): string {
	if (!skills.length) return '';
	const titles = skills.map((s) => s.title).join('、');
	const bodies = skills
		.map((s) => `### Skill: ${s.title}\n${s.content}`)
		.join('\n\n');
	return (
		`\n\n【本轮强制 Skills — 必须执行】已启用：${titles}\n` +
		'下列 Skill 正文为硬约束：润色、总结、扩写、闲聊等用户表述若与 Skill 冲突，一律以 Skill 为准；' +
		'禁止忽略 Skill 改用普通文风或通用模板。\n\n' +
		`${bodies}\n`
	);
}

/** 拼入本轮 HumanMessage，再次钉死「必须用 Skill」 */
export function formatSkillsUserForcePrefix(skills: SkillBody[]): string {
	if (!skills.length) return '';
	const titles = skills.map((s) => `「${s.title}」`).join('、');
	return (
		`【强制】本轮必须严格执行已启用 Skill：${titles}。` +
		'完成用户任务时须体现 Skill 要求的风格、结构与约束；不得输出与 Skill 无关的普通改写。\n\n'
	);
}
