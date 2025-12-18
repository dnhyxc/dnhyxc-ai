import { useSearchParams } from 'react-router';

const About = () => {
	const [search] = useSearchParams();

	return (
		<div className="flex justify-center items-center w-full h-full">
			<div>dnhyxc-ai 版本 {search.get('version')}</div>
		</div>
	);
};

export default About;
