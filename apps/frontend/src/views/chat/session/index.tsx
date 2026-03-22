import ChatBot from '@design/ChatBot';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import Loading from '@/components/design/Loading';
import { getSession } from '@/service';
import useStore from '@/store';

const Session = () => {
	const params = useParams();
	const { chatStore } = useStore();

	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// 只有在刷新后，store 中的 messages 为空的时候才调用接口获取 messages，
		// 同时要保证 chatStore.sessionData.total 为 0，防止进入的是空 session，并没有对话的情况
		if (
			params.id &&
			!chatStore.messages.length &&
			!chatStore.sessionData.total
		) {
			chatStore.setActiveSessionId(params.id);
			getSessionInfo(params.id);
		}
	}, [params.id, chatStore.messages, chatStore.sessionData.total]);

	const getSessionInfo = useCallback(
		async (id: string) => {
			try {
				setLoading(true);
				const res = await getSession(id);
				if (res.success && res.data.messages.length) {
					chatStore.setAllMessages(res.data.messages, id, false);
					chatStore.setActiveSessionId(id);
				}
			} finally {
				setLoading(false);
			}
		},
		[chatStore],
	);

	return (
		<div className="flex-1 w-full overflow-hidden">
			{loading && (
				<div className="absolute top-0 left-0 z-900 flex flex-col gap-5 items-center justify-center w-full h-full bg-theme-background/80 rounded-md">
					<Loading />
				</div>
			)}
			<ChatBot />
		</div>
	);
};

export default Session;
