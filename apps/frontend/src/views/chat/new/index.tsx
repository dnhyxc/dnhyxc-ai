import ChatNewSession from '@design/ChatNewSession';
import { observer } from 'mobx-react';
import { useEffect } from 'react';
import { useChatCore } from '@/hooks/useChatCore';

const NewChat = observer(() => {
	const { clearChat } = useChatCore();

	// 从其他路由进入到新会话页时，清空当前会话，比如从 home 页面进入时，如果不清空，会继续使用上次会话的 sessionId，将内容添加到之前的会话中
	useEffect(() => {
		clearChat();
	}, []);

	return (
		<div className="flex-1 w-full overflow-hidden">
			<ChatNewSession />
		</div>
	);
});

export default NewChat;
