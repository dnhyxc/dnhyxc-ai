/**
 * 用户服务政策与用户协议正文（中英）。
 * 为产品级通用条款，具体以实际运营主体与司法管辖为准。
 */

import type { Locale } from '@/i18n';

export type LegalSection = {
	title: string;
	paragraphs: string[];
};

const servicePolicyZh: LegalSection[] = [
	{
		title: '1. 适用范围与定义',
		paragraphs: [
			'本《用户服务政策》（下称「本政策」）适用于您访问或使用 dnhyxc-ai（下称「本产品」）及相关客户端、网页端时，我们就服务内容、使用规范与责任边界向您作出的说明。',
			'本产品提供以对话（Chat）、知识库（Markdown 编辑与检索）等为核心的智能辅助能力；具体功能以您当前版本界面为准，并可能随版本迭代调整。',
		],
	},
	{
		title: '2. 账号与访问',
		paragraphs: [
			'部分能力需要您注册并登录账号后方可使用；您应妥善保管账号与认证信息，对账号下的操作行为负责。',
			'若您未登录，本产品可能以「仅本地」等降级方式提供部分知识库能力，此时相关数据主要保留在您的设备或您指定的本地目录，不上传至我们的服务器（以实际界面与网络请求为准）。',
		],
	},
	{
		title: '3. 内容与合规使用',
		paragraphs: [
			'您输入的提示、上传的附件及在知识库中编辑的内容，应遵守法律法规及公序良俗，不得含有违法、侵权、恶意程序或侵害他人合法权益的信息。',
			'您理解 AI 输出具有概率性与局限性，不构成专业意见（如医疗、法律、投资等）；重要决策请咨询具备资质的专业人士。',
		],
	},
	{
		title: '4. 服务变更与中断',
		paragraphs: [
			'我们可能因维护、升级、合规或不可抗力等原因暂停或调整部分功能，并将尽力通过产品内提示或公告等方式告知。',
			'因网络环境、第三方服务、您本地设备或配置导致的服务不可用，我们在法律允许范围内不承担责任。',
		],
	},
	{
		title: '5. 联系我们与政策更新',
		paragraphs: [
			'如您对本政策有疑问，可通过产品内提供的反馈渠道或官网联系方式与我们沟通。',
			'我们可能适时修订本政策；重大变更时将以合理方式提示。您在变更后继续使用本产品，即视为知悉并同意更新后的政策。',
		],
	},
];

const servicePolicyEn: LegalSection[] = [
	{
		title: '1. Scope and definitions',
		paragraphs: [
			'This User Service Policy (“Policy”) applies when you access or use dnhyxc-ai (“Product”), including desktop and web clients.',
			'The Product offers AI-assisted features such as chat and Markdown-based knowledge management. Available features depend on your version and may change over time.',
		],
	},
	{
		title: '2. Accounts and access',
		paragraphs: [
			'Some features require registration and sign-in. You are responsible for safeguarding credentials and for activity under your account.',
			'When you are not signed in, the Product may offer limited or local-only knowledge features; data may remain on your device per the UI and actual network behavior.',
		],
	},
	{
		title: '3. Content and acceptable use',
		paragraphs: [
			'Your prompts, uploads, and knowledge content must comply with applicable laws and must not infringe others’ rights or contain unlawful or harmful material.',
			'AI outputs are probabilistic and not professional advice (e.g. medical, legal, or financial). Seek qualified professionals for important decisions.',
		],
	},
	{
		title: '4. Changes and interruptions',
		paragraphs: [
			'We may suspend or adjust features for maintenance, upgrades, compliance, or force majeure, and will try to notify you in-product or via notices.',
			'We are not liable, to the extent permitted by law, for unavailability due to networks, third parties, or your devices and configuration.',
		],
	},
	{
		title: '5. Contact and updates',
		paragraphs: [
			'For questions about this Policy, use in-product feedback or official contact channels.',
			'We may revise this Policy from time to time; material changes will be highlighted reasonably. Continued use after updates constitutes acceptance.',
		],
	},
];

const userAgreementZh: LegalSection[] = [
	{
		title: '1. 协议的接受与修订',
		paragraphs: [
			'欢迎使用 dnhyxc-ai。当您注册、登录、下载、安装或以其他方式使用本产品时，即表示您已阅读并同意受本《用户服务协议》（下称「本协议」）约束。',
			'我们有权根据业务与法律要求修订本协议；更新后将在产品中或以其他合理方式公示。若您不同意修订内容，请停止使用；继续使用视为接受修订后的协议。',
		],
	},
	{
		title: '2. 服务说明',
		paragraphs: [
			'本产品向您提供人工智能辅助的对话、知识库编辑与检索、分享与设置等相关功能；具体以实际提供为准。',
			'部分能力依赖第三方模型、检索或存储服务，其可用性与响应质量可能受网络、配额及第三方政策影响。',
		],
	},
	{
		title: '3. 用户行为规范',
		paragraphs: [
			'您不得利用本产品从事违法违规活动，不得干扰或破坏服务与系统安全，不得未经授权访问他人数据。',
			'您对提交的内容拥有合法权利或已获授权；因您提供的内容引起的纠纷与责任，由您自行承担。',
		],
	},
	{
		title: '4. 知识产权',
		paragraphs: [
			'本产品中的软件、界面、文档及商标等知识产权归我们或权利人所有，未经许可不得复制、修改或商业使用。',
			'在适用法律允许的范围内，您对基于本产品生成的输出之使用由您自行判断与负责；请勿侵犯第三方权利。',
		],
	},
	{
		title: '5. 免责声明与责任限制',
		paragraphs: [
			'本产品按「现状」提供，我们不对 AI 生成内容的准确性、完整性或适用性作担保。',
			'在法律允许的最大范围内，我们对因使用或无法使用本产品而产生的间接、附带或惩罚性损害不承担责任；我们对您的赔偿责任以您就争议服务已支付的费用为上限（若适用且无相反强制性规定）。',
		],
	},
	{
		title: '6. 协议终止',
		paragraphs: [
			'您可随时停止使用并注销账号（若产品提供该能力）。我们可在您严重违约或法律法规要求时中止或终止向您提供服务。',
		],
	},
	{
		title: '7. 适用法律与争议解决',
		paragraphs: [
			'本协议的订立、效力与解释均适用中华人民共和国大陆地区法律（仅为示例，实际以运营主体所在地及公示为准）。',
			'因本协议引起的争议，双方应友好协商；协商不成的，提交有管辖权的人民法院诉讼解决（具体管辖以届时公示或专属协议为准）。',
		],
	},
];

const userAgreementEn: LegalSection[] = [
	{
		title: '1. Acceptance and changes',
		paragraphs: [
			'By registering, signing in, installing, or using dnhyxc-ai (“Product”), you agree to this User Service Agreement (“Agreement”).',
			'We may update this Agreement; continued use after notice constitutes acceptance. Stop using the Product if you disagree.',
		],
	},
	{
		title: '2. Description of services',
		paragraphs: [
			'The Product provides AI-assisted chat, Markdown knowledge features, sharing, settings, and related capabilities as actually offered.',
			'Some features rely on third-party models or infrastructure; availability and quality may vary.',
		],
	},
	{
		title: '3. User conduct',
		paragraphs: [
			'You must not use the Product unlawfully, compromise security, or access others’ data without authorization.',
			'You represent you have rights or permission for content you submit and bear responsibility for disputes arising from it.',
		],
	},
	{
		title: '4. Intellectual property',
		paragraphs: [
			'Software, UI, documentation, and marks belong to us or licensors and may not be copied or exploited without permission.',
			'You are responsible for lawful use of model outputs and for not infringing third-party rights.',
		],
	},
	{
		title: '5. Disclaimer and limitation of liability',
		paragraphs: [
			'The Product is provided “as is” without warranties as to accuracy or fitness of AI outputs.',
			'To the maximum extent permitted by law, we are not liable for indirect or consequential damages; direct liability may be capped by fees paid for the disputed service where applicable.',
		],
	},
	{
		title: '6. Termination',
		paragraphs: [
			'You may stop using the Product and close your account if available. We may suspend or terminate access for material breach or legal requirements.',
		],
	},
	{
		title: '7. Governing law and disputes',
		paragraphs: [
			'This Agreement is governed by the laws of the jurisdiction where the operating entity is located (placeholder; see published notices).',
			'Disputes should first be resolved amicably; otherwise they may be submitted to competent courts as disclosed in product notices.',
		],
	},
];

export function getServicePolicySections(locale: Locale): LegalSection[] {
	return locale === 'en-US' ? servicePolicyEn : servicePolicyZh;
}

export function getUserAgreementSections(locale: Locale): LegalSection[] {
	return locale === 'en-US' ? userAgreementEn : userAgreementZh;
}
