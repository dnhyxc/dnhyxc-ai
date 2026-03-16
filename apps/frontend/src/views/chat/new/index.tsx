import ChatNewSession from '@design/ChatNewSession';
import { observer } from 'mobx-react';

const NewChat = observer(() => {
	return (
		<div className="flex-1 w-full overflow-hidden">
			<ChatNewSession />
		</div>
	);
});

export default NewChat;
