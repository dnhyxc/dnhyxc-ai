import { Button } from '@ui/button';
import { useEffect } from 'react';
import { getStorage, onEmit, onListen, setBodyClass } from '@/utils';
import axios from '@/utils/axios';

const Detail = () => {
	const theme = getStorage('theme');

	useEffect(() => {
		setBodyClass(theme as 'light' | 'dark');

		const unlistenPromise = onListen('message', (value: string) => {
			console.log('message', value);
		});

		const unlistenThemePromise = onListen('theme', (value: string) => {
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

	const getUsers = async () => {
		const res = await axios.get('/user/getUsers');
		console.log(res);
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<h1>Detail</h1>
			<div>
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={sendMessage}
				>
					send message
				</Button>
				<Button variant="default" className="cursor-pointer" onClick={getUsers}>
					Get Users
				</Button>
			</div>
		</div>
	);
};

export default Detail;
