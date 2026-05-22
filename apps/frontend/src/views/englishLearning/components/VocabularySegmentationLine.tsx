/** 单词音节划分展示行（有内容时渲染） */
export function VocabularySegmentationLine({
	segmentation,
	className = 'text-textcolor/85 text-sm leading-snug my-1',
}: {
	segmentation?: string | null;
	className?: string;
}) {
	const text = segmentation?.trim();
	if (!text) return null;
	return <div className={className}>{text}</div>;
}
