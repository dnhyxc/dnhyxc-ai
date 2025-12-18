import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { onEmit, onListen } from '@/utils/event';

const About = () => {
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
		<div>
			<h1>About</h1>
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
	);
};

export default About;
