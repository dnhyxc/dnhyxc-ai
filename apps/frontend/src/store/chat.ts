import { Message, SessionData } from '@/types/chat';
import { makeAutoObservable } from 'mobx';

class ChatStore {
	constructor() {
		makeAutoObservable(this);
	}

	messages: Message[] = [];

	sessionData: SessionData = {
		list: [],
		total: 0,
	};

	setAllMessages(messages: Message[], activeSessionId: string) {
		this.messages = messages;
		this.sessionData.list.forEach((item) => {
			if (item.id === activeSessionId) {
				item.messages = messages;
			}
		});
	}

	setSessionData(data: SessionData) {
		console.log('setSessionData', data);
		this.sessionData = data;
	}
}

export default new ChatStore();
