import {
	SandpackCodeEditor,
	SandpackConsole,
	SandpackPreview,
	SandpackProvider,
} from '@codesandbox/sandpack-react';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import Toolbar from './toolbar';

const CodeRunner = () => {
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
								<Toolbar />
								<div className="flex flex-1 rounded-b-md">
									<ResizablePanelGroup
										orientation="horizontal"
										className="h-full w-full rounded-b-md"
									>
										{/* 左侧编辑器 */}
										<ResizablePanel defaultSize="50%" className="w-full h-full">
											<SandpackCodeEditor className="h-full" />
										</ResizablePanel>
										<ResizableHandle withHandle />
										{/* 右侧区域 */}
										<ResizablePanel defaultSize="50%" className="w-full h-full">
											<div className="flex-1 flex flex-col h-full">
												{/* UI 预览 */}
												<ResizablePanelGroup
													orientation="vertical"
													className="flex-1 flex flex-col h-full"
												>
													<ResizablePanel defaultSize="50%">
														<SandpackPreview
															showRestartButton
															showOpenInCodeSandbox={false}
															className="flex-1! h-full! w-full!"
														/>
													</ResizablePanel>
													<ResizableHandle withHandle />
													{/* 控制台 */}
													<ResizablePanel defaultSize="50%">
														<SandpackConsole
															resetOnPreviewRestart
															className="w-full! flex-1! h-full!"
														/>
													</ResizablePanel>
												</ResizablePanelGroup>
											</div>
										</ResizablePanel>
									</ResizablePanelGroup>
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
