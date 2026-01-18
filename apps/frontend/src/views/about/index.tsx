import { openUrl } from '@tauri-apps/plugin-opener';
import { Button } from '@ui/button';
import { useGetVersion, useTheme } from '@/hooks';

const About = () => {
	const { version } = useGetVersion();

	useTheme();

	const handleOpenLink = (url: string) => {
		openUrl(url);
	};

	return (
		<div className="flex flex-col justify-center items-center w-full h-full">
			<div className="mb-10">dnhyxc-ai 版本 {version}</div>
			<div className="flex flex-col justify-center items-center">
				<div className="mb-2.5">dnhyxc 版权所有</div>
				<div className="mb-2">Copyright © 2025 - 2026 Dnhyxc</div>
				<div className="mb-2">All Rights Reserved</div>
				<div className="flex justify-center">
					<Button
						variant="link"
						onClick={() =>
							handleOpenLink(
								'https://github.com/dnhyxc/dnhyxc-ai/blob/master/client/README.md',
							)
						}
						className="mr-6 text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
					>
						服务政策
					</Button>
					<Button
						variant="link"
						onClick={() => handleOpenLink('https://dnhyxc.cn')}
						className="text-blue-500 hover:text-blue-400 text-md bg-transparent border-none cursor-pointer p-0"
					>
						用户服务协议
					</Button>
				</div>
			</div>
		</div>
	);
};

export default About;
