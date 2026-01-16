import { useGetVersion } from '@/hooks';

const About = () => {
	const { version } = useGetVersion();

	return (
		<div className="flex justify-center items-center w-full h-full">
			<div>dnhyxc-ai 版本 {version}</div>
		</div>
	);
};

export default About;
