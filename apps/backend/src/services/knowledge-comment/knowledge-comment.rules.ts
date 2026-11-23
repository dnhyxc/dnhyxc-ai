export type CommentAudience = 'owner' | 'readers';

export type ReplyHit = {
	id: string;
	parentId: string | null;
	audience: CommentAudience;
	userId: number;
};

/** 根留言的受众只看文档此刻是否公开，客户端不能改。 */
export function audienceForRoot(isPublic: boolean): CommentAudience {
	return isPublic ? 'readers' : 'owner';
}

/**
 * 回复一律挂到根上，并复制根的受众。
 * 非作者点到 owner 行时返回 hidden，调用方用 404，避免探出「这条锁着」。
 */
export function placeReply(
	hit: ReplyHit,
	root: { id: string; audience: CommentAudience } | null,
	isOwned: boolean,
):
	| { kind: 'hidden' }
	| { kind: 'missing' }
	| {
			kind: 'ok';
			parentId: string;
			audience: CommentAudience;
			replyToUserId: number | null;
	  } {
	if (hit.audience === 'owner' && !isOwned) return { kind: 'hidden' };
	const base = hit.parentId ? root : { id: hit.id, audience: hit.audience };
	if (!base) return { kind: 'missing' };
	return {
		kind: 'ok',
		parentId: base.id,
		audience: base.audience,
		replyToUserId: hit.parentId ? hit.userId : null,
	};
}
