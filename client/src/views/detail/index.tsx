import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { getUsers } from '@/service';
import { deleteValue, getValue, onEmit, setValue } from '@/utils';

const Detail = () => {
	const sendMessage = async () => {
		await onEmit('about-send-message', { message: 'about message' });
	};

	const getUserList = async () => {
		const res = await getUsers();
		console.log(res);
	};

	const setSettings = async () => {
		await setValue('test-key', 'test');
	};

	const getSettings = async () => {
		const res = await getValue('test-key');
		console.log('getSettings', res);
	};

	const deleteSettings = async () => {
		await deleteValue('test-key');
		await getValue('test-key');
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<ScrollArea className="w-full h-full overflow-y-auto p-2.5 rounded-none">
				<h1>Detail</h1>
				<div>
					<Button
						variant="default"
						className="cursor-pointer"
						onClick={sendMessage}
					>
						send message
					</Button>
					<Button
						variant="default"
						className="cursor-pointer"
						onClick={getUserList}
					>
						Get Users
					</Button>
				</div>
				<div className="flex justify-center items-center gap-4 mt-10">
					<Button className="cursor-pointer" onClick={setSettings}>
						保存设置
					</Button>
					<Button className="cursor-pointer" onClick={getSettings}>
						获取设置
					</Button>
					<Button className="cursor-pointer" onClick={deleteSettings}>
						删除设置
					</Button>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Detail;
