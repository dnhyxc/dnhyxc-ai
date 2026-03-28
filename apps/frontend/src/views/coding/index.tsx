// https://sandpack.codesandbox.io/docs/getting-started/usage
import {
	type CodeEditorRef,
	type SANDBOX_TEMPLATES,
	SandpackCodeEditor,
	SandpackConsole,
	SandpackPreview,
	SandpackProvider,
} from '@codesandbox/sandpack-react';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import Toolbar from './Toolbar';
import { tauriSandpackClipboardExtension } from './tauriSandpackClipboard';

type TemplateKey = keyof typeof SANDBOX_TEMPLATES;

interface SandpackWorkspaceProps {
	template: TemplateKey;
	setTemplate: (t: TemplateKey) => void;
}

/** 必须在 SandpackProvider 内，以便 useActiveCode / 编辑器 ref 生效 */
const SandpackWorkspace = ({
	template,
	setTemplate,
}: SandpackWorkspaceProps) => {
	const editorRef = useRef<CodeEditorRef>(null);

	return (
		<div className="flex flex-col h-full">
			<Toolbar
				editorRef={editorRef}
				template={template}
				setTemplate={setTemplate}
			/>
			<div className="flex flex-1 rounded-b-md overflow-hidden">
				<ResizablePanelGroup
					orientation="horizontal"
					className="h-full w-full rounded-b-md"
				>
					{/* 左侧编辑器 */}
					<ResizablePanel defaultSize="50%" className="w-full h-full">
						<SandpackCodeEditor
							ref={editorRef}
							className="h-full"
							showTabs
							closableTabs
							extensions={[tauriSandpackClipboardExtension]}
						/>
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
										className="flex-1! h-full!"
									/>
								</ResizablePanel>
								<ResizableHandle withHandle />
								{/* 控制台 */}
								<ResizablePanel defaultSize="50%">
									<SandpackConsole
										resetOnPreviewRestart
										className="w-full! h-full!"
									/>
								</ResizablePanel>
							</ResizablePanelGroup>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
};

const CodeRunner = () => {
	const [template, setTemplate] = useState<TemplateKey>('react');

	return (
		<div className="flex flex-1 flex-col h-full w-full rounded-b-md">
			<ScrollArea className="flex-1 rounded-md overflow-hidden w-full backdrop-blur-sm">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="h-full p-5 pt-0 rounded-md w-[calc(100vw-110px)]"
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5 }}
						className="w-full h-full rounded-md border border-theme/5"
					>
						<SandpackProvider
							template={template}
							theme="dark"
							options={{
								autorun: false,
								recompileMode: 'immediate',
							}}
							className="h-full!"
						>
							<SandpackWorkspace
								template={template}
								setTemplate={setTemplate}
							/>
						</SandpackProvider>
					</motion.div>
				</motion.div>
			</ScrollArea>
		</div>
	);
};

export default CodeRunner;
