import ChatBot from '@design/ChatBot';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { getSession } from '@/service';
import useStore from '@/store';

const Session = () => {
	const params = useParams();

	const { chatStore } = useStore();

	useEffect(() => {
		// 只有在刷新后，store 中的 messages 为空的时候才调用接口获取 messages，
		// 同时要保证 chatStore.sessionData.total 为 0，防止进入的是空 session，并没有对话的情况
		if (
			params.id &&
			!chatStore.messages.length &&
			!chatStore.sessionData.total
		) {
			getSessionInfo(params.id);
		}
	}, [params.id, chatStore.messages, chatStore.sessionData.total]);

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
