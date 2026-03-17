import ChatBot from '@design/ChatBot';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { getSession } from '@/service';
import useStore from '@/store';

const Session = () => {
	const params = useParams();

	const { chatStore } = useStore();

	useEffect(() => {
		// 只有在刷新后，store 中的 messages 为空的时候才调用接口获取 messages
		if (params.id && !chatStore.messages.length) {
			getSessionInfo(params.id);
		}
	}, [params.id, chatStore.messages]);

	const getSessionInfo = async (id: string) => {
		const res = await getSession(id);
		if (res.success && res.data.messages.length) {
			chatStore.setAllMessages(res.data.messages, id, false);
			chatStore.setActiveSessionId(id);
		}
	};

	return (
		<div className="flex-1 w-full overflow-hidden">
			<ChatBot />
		</div>
	);
};

export default Session;
