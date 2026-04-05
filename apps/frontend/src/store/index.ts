/*
 * @Description: store
 * @Author: dnh
 * @Date: 2022-06-10 14:40:30
 * @LastEditors: dnh
 * @FilePath: \example\react\mobx\src\store\index.ts
 * @LastEditTime: 2022-06-10 14:52:26
 */
import { createContext, useContext } from 'react';
import AuthStore from './auth';
import ChatStore from './chat';
import KnowledgeStore from './knowledge';
import UserStore from './user';

class RootStore {
	authStore = AuthStore;
	userStore = UserStore;
	chatStore = ChatStore;
	knowledgeStore = KnowledgeStore;
}

const store = new RootStore();

const Context = createContext(store);

export default function useStore() {
	return useContext(Context);
}
