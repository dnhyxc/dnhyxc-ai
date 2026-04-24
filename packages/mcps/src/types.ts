/** 与 catalog/components.json 中单项结构对齐（字段可选以兼容后续扩展） */
export type CatalogComponentProp = {
	name: string;
	type: string;
	description: string;
};

export type CatalogComponentExample = {
	/**
	 * 示例标题（推荐字段）。
	 * 为兼容旧 catalog：允许缺省，旧字段为 name/description。
	 */
	title?: string;
	/** @deprecated 兼容旧 catalog */
	name?: string;
	/** @deprecated 兼容旧 catalog */
	description?: string;
	code: string;
};

export type CatalogComponent = {
	id: string;
	group: string;
	slug: string;
	name: string;
	title: string;
	category: string;
	description: string;
	tags: string[];
	props: CatalogComponentProp[];
	examples: CatalogComponentExample[];
	source: string;
	parent?: string;
	relatedSources?: string[];
};

export type ComponentsCatalogFile = {
	version: string;
	basePath: string;
	description?: string;
	components: CatalogComponent[];
};
