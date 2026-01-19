import { Carousel, CarouselContent, CarouselItem } from '@ui/carousel';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect } from 'react';
import { onListen } from '@/utils';

const Home = () => {
	// 在组件中添加进度监听
	useEffect(() => {
		const unlistenAboutPromise = onListen('about-send-message', (event) => {
			console.log('about-send-message', event);
		});

		const unlistenShortcut = onListen('shortcut-triggered', (event) => {
			console.log('shortcut-triggered', event);
		});

		return () => {
			unlistenAboutPromise.then((unlisten) => unlisten());
			unlistenShortcut.then((unlisten) => unlisten());
		};
	}, []);

	return (
		<div className="w-full h-full flex flex-col justify-center items-center p-1.5 rounded-md">
			<div className="w-full h-43 flex items-center justify-center">
				<Carousel
					opts={{
						align: 'start',
						loop: true,
					}}
					className="w-full h-full"
				>
					<CarouselContent>
						{Array.from({ length: 10 }).map((_, index) => (
							<CarouselItem key={index} className="md:basis-1/2 lg:basis-1/4">
								<div className="px-1.5 h-43 rounded-md">
									<div className="h-full w-full text-3xl font-semibold rounded-md bg-theme-background">
										{index + 1}
									</div>
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>
			</div>
			<div className="flex-1 w-full p-1.5 mt-2 overflow-y-auto">
				<ScrollArea className="h-full p-1.5 bg-theme-background rounded-md">
					<div className="h-500">aaaaa</div>
				</ScrollArea>
			</div>
		</div>
	);
};

export default Home;
