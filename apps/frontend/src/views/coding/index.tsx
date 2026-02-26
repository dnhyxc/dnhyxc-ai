import { useState } from 'react';
import {
	SandpackProvider,
	SandpackCodeEditor,
	SandpackConsole,
	SandpackPreview,
} from '@codesandbox/sandpack-react';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import Toolbar from './toolbar';

const CodeRunner = () => {
	const [isPreviewVisible, setIsPreviewVisible] = useState(true);
	const [isConsoleVisible, setIsConsoleVisible] = useState(true);

	return (
		<div className="flex flex-col h-full w-full rounded-b-md">
			<ScrollArea className="flex-1 rounded-md overflow-hidden w-full backdrop-blur-sm">
				<div className="w-full h-full p-5 pt-0 rounded-md">
					<div className="w-full h-full rounded-md border border-theme/5">
						<SandpackProvider
							template="react"
							theme="dark"
							options={{
								autorun: false,
								recompileMode: 'immediate',
							}}
							className="h-full!"
						>
							<div className="flex flex-col h-full">
								{/* 顶部工具栏 */}
								<Toolbar
									isPreviewVisible={isPreviewVisible}
									onTogglePreview={() => setIsPreviewVisible(!isPreviewVisible)}
									isConsoleVisible={isConsoleVisible}
									onToggleConsole={() => setIsConsoleVisible(!isConsoleVisible)}
								/>

								<div className="flex flex-1 overflow-hidden rounded-b-md">
									{/* 左侧编辑器 */}
									<SandpackCodeEditor
										className={`${isPreviewVisible || isConsoleVisible ? 'w-[50%]!' : 'w-full!'}`}
									/>

									{/* 右侧区域 */}
									<div className="flex-1 flex flex-col border-l border-theme/5">
										{/* UI 预览 */}
										<SandpackPreview
											showRestartButton
											showOpenInCodeSandbox={false}
											className={`flex-1! ${isConsoleVisible ? 'h-[50%]!' : 'h-full!'} ${isPreviewVisible ? 'flex!' : 'hidden!'}`}
										/>
										{/* 控制台 */}
										<SandpackConsole
											className={`flex-1! ${isPreviewVisible ? 'h-[50%]!' : 'h-full!'} ${isConsoleVisible ? 'flex!' : 'hidden!'}`}
											resetOnPreviewRestart
										/>
									</div>
								</div>
							</div>
						</SandpackProvider>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default CodeRunner;
