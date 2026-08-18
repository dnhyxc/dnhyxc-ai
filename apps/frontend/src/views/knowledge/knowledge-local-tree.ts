/** 本地知识库：把扁平 .md 列表收成可展开目录树（仅含含有 .md 的路径） */

/** 目录节点：可展开，children 仅含其下仍有 .md 的子目录/文件 */
export type LocalMdTreeDir = {
	type: 'dir';
	/** 本层目录名（不含路径） */
	name: string;
	/** 规范化后的绝对路径，作展开集合的 key */
	path: string;
	children: LocalMdTreeNode[];
};

/** 叶子：一篇本地 .md */
export type LocalMdTreeFile = {
	type: 'file';
	/** 文件名（含 .md） */
	name: string;
	/** 规范化后的绝对路径 */
	path: string;
	/** 展示标题（通常来自 frontmatter / 文件名） */
	title: string;
	updatedAt: string;
};

export type LocalMdTreeNode = LocalMdTreeDir | LocalMdTreeFile;

/** 构建树的输入：扁平 .md 列表，path 须落在根目录之下 */
export type LocalMdTreeEntry = {
	path: string;
	title: string;
	updatedAt: string;
};

/** 统一为正斜杠、去掉末尾 /，便于前缀匹配与分段 */
export function normalizeFsPath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** 取最后一段；无 / 时整段即名；末段为空则回退整路径 */
export function basenameFs(p: string): string {
	const n = normalizeFsPath(p);
	const i = n.lastIndexOf('/');
	return i < 0 ? n : n.slice(i + 1) || n;
}

/**
 * 由根目录 + 扁平 .md 条目构建树。
 * 只挂「根下」的文件；中间目录按需创建（空目录不会出现）。
 * 建完后递归排序：同级目录优先，再按中文 locale 比 name。
 */
export function buildLocalMdTree(
	// 知识库根目录的绝对路径；会先规范化再当树根 path
	rootDir: string,
	// 扁平 .md 列表；每条须落在 rootDir 之下，否则本轮跳过
	entries: LocalMdTreeEntry[],
): LocalMdTreeDir {
	// 统一正斜杠、去掉末尾 /，后续前缀匹配与分段都依赖这个形态
	const rootPath = normalizeFsPath(rootDir);
	// 树根：name 取最后一段，空则回退整路径；children 稍后按条目挂上
	const root: LocalMdTreeDir = {
		type: 'dir',
		name: basenameFs(rootPath) || rootPath,
		path: rootPath,
		children: [],
	};
	// 用「根路径 + /」做前缀，避免 /foo 误匹配 /foobar
	const prefix = `${rootPath}/`;

	// 逐条把文件挂进树：中间目录按需创建，空目录不会出现
	for (const e of entries) {
		// 条目 path 同样规范化，才能和 prefix / 分段规则对齐
		const filePath = normalizeFsPath(e.path);
		// 不在根下（含恰好等于根、无子路径）的条目丢掉，避免挂到树外
		if (!filePath.startsWith(prefix)) continue;
		// 相对根的路径段；最后一段是文件名，前面是目录链
		const parts = filePath.slice(prefix.length).split('/').filter(Boolean);
		// 切完没有段（例如只剩空串）说明不是根下的文件，跳过
		if (parts.length === 0) continue;

		// 从根往下走目录链；循环结束后 parent 就是该文件应挂入的目录
		let parent = root;
		// 只遍历「文件名之前」的段，每段对应一层中间目录
		for (let i = 0; i < parts.length - 1; i++) {
			// 本层目录名；parts 已 filter(Boolean)，非空，! 仅消 TS
			const name = parts[i]!;
			// 子目录绝对 path = 当前 parent.path + / + 本段名，作去重 key
			const childPath = `${parent.path}/${name}`;
			// 同路径目录只建一次，后续文件复用
			let child = parent.children.find(
				(c): c is LocalMdTreeDir => c.type === 'dir' && c.path === childPath,
			);
			// 第一次见到这条路径才新建空目录并挂到当前层
			if (!child) {
				child = { type: 'dir', name, path: childPath, children: [] };
				parent.children.push(child);
			}
			// 下钻：下一层中间目录或最终文件都挂在这个 child 上
			parent = child;
		}

		// 最后一段是文件名（含 .md）；前面目录链已走完
		const fileName = parts[parts.length - 1]!;
		// 叶子挂到最终 parent；title / updatedAt 原样来自扁平条目
		parent.children.push({
			type: 'file',
			name: fileName,
			path: filePath,
			title: e.title,
			updatedAt: e.updatedAt,
		});
	}

	// 整棵树就地递归排序：同级 dir 在 file 前，再按中文 locale 比 name
	sortDir(root);
	// 返回已挂好、已排序的根；调用方用 root.path 当展开集合的 key
	return root;
}

/** 就地递归排序：dir 在 file 前；同类型按 name 中文序 */
function sortDir(dir: LocalMdTreeDir): void {
	// 就地排当前层 children：目录永远在文件前面，同类型再按名字比
	dir.children.sort((a, b) => {
		// 类型不同时 dir 返回 -1 靠前，file 返回 1 靠后；同类型落到下面的名字比较
		if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
		// 同类型用中文 locale 比 name，让「笔记」「资源」这类中文名按语言序稳定排列
		return a.name.localeCompare(b.name, 'zh');
	});
	// 本层排完后，对每个子目录递归同一套规则，保证整棵子树都有序
	for (const c of dir.children) {
		if (c.type === 'dir') sortDir(c);
	}
}

/**
 * 按 expanded（目录 path 集合）把树拍成可见行。
 * 根始终输出；仅 expanded 含该 dir.path 时才下钻 children。
 * depth 从 0 起，给 UI 缩进用。
 */
export function flattenVisibleLocalMdTree(
	// 整棵本地 Markdown 树的根目录；flatten 从这里开始，根节点始终会出现在结果第一行
	root: LocalMdTreeDir,
	// 当前已展开的目录 path 集合（只读）；只有 path 落在这里的 dir 才会继续下钻 children
	expanded: ReadonlySet<string>,
): Array<{ node: LocalMdTreeNode; depth: number }> {
	// 可见行累加器：前序 DFS 顺序，与 UI 从上到下渲染顺序一致
	const out: Array<{ node: LocalMdTreeNode; depth: number }> = [];
	// 递归走树：先把自己写进 out，再按 expanded 决定要不要进子节点
	const walk = (node: LocalMdTreeNode, depth: number) => {
		// 当前节点无论 dir/file 都可见；depth 给 UI 做缩进（根为 0）
		out.push({ node, depth });
		// 文件没有 children；目录也必须在 expanded 里才展开，折叠目录只占一行
		if (node.type === 'dir' && expanded.has(node.path)) {
			// 子节点 depth + 1；children 已由 sortDir 排好（dir 在前、同类型中文序）
			for (const c of node.children) walk(c, depth + 1);
		}
	};
	// 从根、深度 0 起走；根不依赖 expanded，保证树至少有一行
	walk(root, 0);
	return out;
}

/** 收集树上所有目录 path（含根）；搜索时用来一次性展开匹配结果的祖先 */
export function collectLocalMdDirPaths(root: LocalMdTreeDir): string[] {
	const out: string[] = [];
	const walk = (dir: LocalMdTreeDir) => {
		out.push(dir.path);
		for (const c of dir.children) {
			if (c.type === 'dir') walk(c);
		}
	};
	walk(root);
	return out;
}
