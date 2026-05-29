/** 单词音节划分展示行（有内容时渲染） */
export function SegmentationLine({
	segmentation,
	className = 'text-textcolor/85 leading-snug',
}: {
	segmentation?: string | null;
	className?: string;
}) {
	const text = segmentation?.trim();
	if (!text) return null;
	return <div className={className}>{text}</div>;
}
