export class ZhipuStreamData {
	type:
		| 'content'
		| 'thinking'
		| 'tool_calls'
		| 'audio'
		| 'usage'
		| 'video'
		| 'web_search'
		| 'content_filter';
	data: any;
}
