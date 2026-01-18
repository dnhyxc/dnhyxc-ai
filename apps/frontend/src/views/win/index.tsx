import Header from '@design/Header';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect } from 'react';
import { type ThemeName, useTheme } from '@/hooks';
import { onListen } from '@/utils';
import { onEmit } from '@/utils/event';

const ChildWindow = () => {
	const { changeTheme } = useTheme();

	useEffect(() => {
		const unlistenPromise = onListen('message', (value: string) => {
			console.log('message', value);
		});

		const unlistenThemePromise = onListen('theme', (value: string) => {
			changeTheme(value as ThemeName, false);
		});

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
			unlistenThemePromise.then((unlisten) => unlisten());
		};
	}, []);

	const sendMessage = async () => {
		await onEmit('about-send-message', { message: 'about message' });
	};

	return (
		<div className="w-full h-full flex flex-col rounded-lg box-border overflow-hidden">
			<Header actions={false} />
			<div
				className={`h-[calc(100%-60px)] flex-1 flex justify-center items-center box-border px-5 pb-5`}
			>
				<ScrollArea className="w-full h-full flex justify-center items-center box-border rounded-lg p-1 shadow-(--shadow-2)">
					<div className="w-full h-full flex-1 flex-col justify-center items-center">
						<h1>All Child Window</h1>
						<Input placeholder="input" />
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
