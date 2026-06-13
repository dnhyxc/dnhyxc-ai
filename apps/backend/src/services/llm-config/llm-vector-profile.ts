/** 用户曾保存过的「向量库 + 模型」检索档位（按 collection 唯一） */
export type VectorSearchProfile = {
	collectionName: string;
	embeddingModel: string;
	rerankModel: string;
};

export function buildVectorSearchProfile(input: {
	collectionName: string;
	embeddingModel: string;
	rerankModel: string;
}): VectorSearchProfile | null {
	const collectionName = input.collectionName.trim();
	const embeddingModel = input.embeddingModel.trim();
	const rerankModel = input.rerankModel.trim();
	if (!collectionName || !embeddingModel || !rerankModel) return null;
	return { collectionName, embeddingModel, rerankModel };
}

export function parseVectorSearchProfilesJson(
	raw: string | null | undefined,
	fallback: VectorSearchProfile | null,
): VectorSearchProfile[] {
	const fromJson: VectorSearchProfile[] = [];
	if (raw?.trim()) {
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (Array.isArray(parsed)) {
				for (const item of parsed) {
					const profile = buildVectorSearchProfile({
						collectionName: String(
							(item as VectorSearchProfile)?.collectionName ?? '',
						),
						embeddingModel: String(
							(item as VectorSearchProfile)?.embeddingModel ?? '',
						),
						rerankModel: String(
							(item as VectorSearchProfile)?.rerankModel ?? '',
						),
					});
					if (profile) fromJson.push(profile);
				}
			}
		} catch {
			// ignore invalid JSON
		}
	}
	if (fromJson.length > 0) return fromJson;
	return fallback ? [fallback] : [];
}

export function mergeVectorSearchProfile(
	list: VectorSearchProfile[],
	profile: VectorSearchProfile,
): VectorSearchProfile[] {
	const key = profile.collectionName;
	const rest = list.filter((p) => p.collectionName !== key);
	return [...rest, profile];
}

export function serializeVectorSearchProfiles(
	profiles: VectorSearchProfile[],
): string {
	return JSON.stringify(profiles);
}
