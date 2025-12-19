import Header from '@design/Header';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect } from 'react';
import { onEmit, onListen } from '@/utils/event';
import { setBodyClass, getStorage } from '@/utils';

const ChildWindow = () => {
	const theme = getStorage('theme');

	useEffect(() => {
		setBodyClass(theme as 'light' | 'dark');

		const unlistenPromise = onListen('message', (value: string) => {
			console.log('message', value);
		});

		const unlistenThemePromise = onListen('theme', (value: string) => {
			console.log('theme', value);
			setBodyClass(value);
		});

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
			unlistenThemePromise.then((unlisten) => unlisten());
		};
	}, [theme]);

	const sendMessage = async () => {
		await onEmit('about-send-message', { message: 'about message' });
	};

	return (
		<div className="w-full h-full flex flex-col rounded-lg box-border overflow-hidden">
			<Header />
			<div
				className={`h-[calc(100%-60px)] flex-1 flex justify-center items-center box-border px-5 pb-5`}
			>
				<ScrollArea className="w-full h-full flex justify-center items-center box-border rounded-lg p-1 shadow-(--shadow)">
					<div className="w-full h-full flex-1 flex-col justify-center items-center">
						<h1>All Child Window</h1>
						<div>
							<Button
								variant="default"
								className="cursor-pointer"
								onClick={sendMessage}
							>
								send message
							</Button>
						</div>
					</div>
				</ScrollArea>
			</div>
		</div>
	);
};

export default ChildWindow;
