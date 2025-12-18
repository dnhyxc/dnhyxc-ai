import { useEffect } from 'react';
import Header from '@/components/design/Header';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { onEmit, onListen } from '@/utils/event';

const Detail = () => {
	useEffect(() => {
		const unlistenPromise = onListen('message', (value: string) => {
			console.log('message', value);
		});

		console.log('unlistenPromise', unlistenPromise);

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
		};
	}, []);

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
						<h1>Detail</h1>
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

export default Detail;
