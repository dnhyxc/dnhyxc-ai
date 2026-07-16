/**
 * 连续滚动听书：当前 iframe 播完后，按 .epub-view 槽位加载下一 iframe。
 * 不合并句流、不 rend.display、不 rend.next。
 */
import type { Rendition } from 'epubjs';
import { stripMarkdownForTts } from '@/utils/speech';
import { getEpubScrollContainer } from '../reader/epubScrolledNav';

// 滚动边缘间距（像素），用于滚动定位向前腾出视野
const SCROLL_EDGE_PX = 16;
// 检查 slot 文档的最大尝试次数
const SLOT_TRIES = 8;
// 尝试推进 scroll listen 章节的最大轮次（每轮可能提前滚动并触发加载）
const ADVANCE_ROUNDS = 5;

// epub 滚动槽的类型，包含视图元素和可挂载的文档对象（可为空表示未加载或跨域）
type EpubViewSlot = {
	viewEl: HTMLElement; // .epub-view 容器元素
	doc: Document | null; // 内嵌 iframe 上的 Document（或 null）
};

// 等待浏览器完成两帧后再继续，用于确保 DOM 更新和布局稳定
function pauseForLayout(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

// 检查指定文档正文是否包含有效文本（去除 Markdown 标记后非空）
function sectionHasText(doc: Document): boolean {
	return (
		stripMarkdownForTts(
			doc.body?.innerText ?? doc.body?.textContent ?? '',
		).trim().length > 0
	);
}

// 尝试获得章节文档的“唯一标识符”，优先 canonical 链接，否则使用 location.href
function docKey(doc: Document): string {
	const canonical = doc
		.querySelector('link[rel="canonical"]')
		?.getAttribute('href');
	if (canonical) return canonical;
	try {
		return doc.defaultView?.location?.href ?? '';
	} catch {
		return '';
	}
}

// 判断两个文档是否互为同一个章节（通过引用或 key 做等价判定）
function sameDoc(a: Document, b: Document): boolean {
	if (a === b) return true;
	const ka = docKey(a);
	const kb = docKey(b);
	return !!ka && ka === kb;
}

// 遍历 epub 滚动容器下所有 .epub-view 槽，收集其挂载的 Document
function listEpubViewSlots(rend: Rendition): EpubViewSlot[] {
	const host = getEpubScrollContainer(rend);
	if (!host) return [];

	const slots: EpubViewSlot[] = [];
	host.querySelectorAll('.epub-view').forEach((viewEl) => {
		const el = viewEl as HTMLElement;
		let doc: Document | null = null;
		try {
			doc = el.querySelector('iframe')?.contentDocument ?? null;
			// 如果存在文档但内容为空，则视为未加载
			if (doc && !sectionHasText(doc)) doc = null;
		} catch {
			// 跨域 iframe，doc 取 null
		}
		slots.push({ viewEl: el, doc });
	});
	return slots;
}

// 调用 epubjs manager.check 力促章节 layout、渲染、定位，最多等待 2 秒
async function invokeManagerCheck(rend: Rendition): Promise<void> {
	const manager = (
		rend as unknown as { manager?: { check?: () => Promise<unknown> } }
	).manager;
	if (!manager?.check) return;
	await Promise.race([
		Promise.resolve(manager.check()).then(() => undefined),
		new Promise<void>((r) => {
			window.setTimeout(r, 2000);
		}),
	]).catch(() => undefined);
}

// 尝试确保指定 slot 可用文档已挂载，若 doc 已挂载直接返回，否则主动尝试加载
async function ensureSlotDocument(
	rend: Rendition,
	slot: EpubViewSlot,
): Promise<Document | null> {
	// 已有文档直接复用
	if (slot.doc) return slot.doc;

	const host = getEpubScrollContainer(rend);
	// 滚动定位到目标 slot
	if (host) {
		host.scrollTo({
			top: Math.max(0, slot.viewEl.offsetTop - SCROLL_EDGE_PX),
			behavior: 'instant',
		});
	}

	// 多次尝试（每次调用 manager.check 并等待浏览器响应）
	for (let i = 0; i < SLOT_TRIES; i += 1) {
		await invokeManagerCheck(rend);
		await pauseForLayout();
		try {
			const doc = slot.viewEl.querySelector('iframe')?.contentDocument ?? null;
			// 只有当文档有正文内容时才返回
			if (doc?.body && sectionHasText(doc)) return doc;
		} catch {
			// 跨域 iframe，忽略
		}
		// 小延迟后重试
		await new Promise<void>((r) => {
			window.setTimeout(r, 80);
		});
	}
	// 多次尝试仍失败，返回 null
	return null;
}

// 在 slots 列表查找当前文档所在槽索引（按引用及 docKey 双重比对）
function findSlotIndex(slots: EpubViewSlot[], currentDoc: Document): number {
	const key = docKey(currentDoc);
	const byRef = slots.findIndex((s) => s.doc === currentDoc);
	if (byRef >= 0) return byRef;
	if (key) {
		return slots.findIndex((s) => s.doc && docKey(s.doc) === key);
	}
	return -1;
}

// 从 slots 列表中顺序查找当前文档后的第一个 loaded 文档（非当前文档且内容有效）
function nextLoadedDoc(
	slots: EpubViewSlot[],
	currentDoc: Document,
): Document | null {
	const idx = findSlotIndex(slots, currentDoc);
	if (idx < 0) return null;
	for (let i = idx + 1; i < slots.length; i += 1) {
		const doc = slots[i]!.doc;
		if (doc && !sameDoc(doc, currentDoc)) return doc;
	}
	return null;
}

// 判断当前是否为 scroll listen 模式（是否启用自定义 epub 容器）
export function isScrollListenMode(rend: Rendition): boolean {
	return getEpubScrollContainer(rend) != null;
}

/**
 * 连续朗读时，查找当前“听书”页面元素之后的下一个已挂载章节文档。
 * 若无可直接用的文档，则尝试主动推进滚动容器加载并挂载新文档。
 */
export async function advanceScrollListenSection(
	rend: Rendition,
	currentDoc: Document,
): Promise<Document | null> {
	// 获取所有槽位及文档
	let slots = listEpubViewSlots(rend);
	// 尝试找到当前文档之后的下一个“可用”文档（已加载、非自身）
	const ready = nextLoadedDoc(slots, currentDoc);
	if (ready) return ready;

	// 若找不到当前文档的索引，则从末尾 slot 往前找最近的已加载 doc 作为基准
	let slotIdx = findSlotIndex(slots, currentDoc);
	if (slotIdx < 0) {
		for (let i = slots.length - 1; i >= 0; i -= 1) {
			if (slots[i]!.doc) {
				slotIdx = i;
				break;
			}
		}
	}

	// 多轮尝试：每轮触发滚动推进加载，看能否获取新的章节文档
	for (let round = 0; round < ADVANCE_ROUNDS; round += 1) {
		// 每次都重列最新的槽和文档
		slots = listEpubViewSlots(rend);
		// 从下一个 slot 开始迭代尝试挂载文档
		for (let i = slotIdx + 1; i < slots.length; i += 1) {
			const doc = await ensureSlotDocument(rend, slots[i]!);
			if (doc && !sameDoc(doc, currentDoc)) return doc;
		}

		// 激进推进滚动（如有 host 则滚动几乎一整屏促使 epub.js 加载下一个章节 iframe）
		const host = getEpubScrollContainer(rend);
		if (host) {
			host.scrollTop += Math.max(200, Math.floor(host.clientHeight * 0.9));
			await invokeManagerCheck(rend);
			await pauseForLayout();
		}
	}

	// 全部尝试失败，返回 null
	return null;
}
