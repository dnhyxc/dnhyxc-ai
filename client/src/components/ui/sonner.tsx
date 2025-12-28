import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps, toast } from 'sonner';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

const Toast = ({
	title,
	message,
	type,
}: {
	type: ToastType;
	title: string;
	message?: string;
}) => {
	const colors: Record<ToastType, string> = {
		success: 'text-green-500',
		error: 'text-red-500',
		warning: 'text-amber-500',
		info: 'text-gray-500',
		loading: 'text-gray-500',
	};

	toast.custom(() => {
		return (
			<div className="flex flex-col justify-center min-h-13 w-80 bg-white dark:bg-gray-900 dark:border-border shadow-lg rounded-md py-2 px-3">
				<div className="flex items-center">
					<div className="w-6 flex justify-center items-center">
						{type === 'success' && (
							<CircleCheckIcon color="var(--color-green-500)" />
						)}
						{type === 'info' && <InfoIcon color="var(--color-gray-500)" />}
						{type === 'warning' && (
							<TriangleAlertIcon color="var(--color-amber-500)" />
						)}
						{type === 'error' && <OctagonXIcon color="var(--color-red-500)" />}
						{type === 'loading' && (
							<Loader2Icon color="var(--color-gray-500)" />
						)}
					</div>
					<div
						className={`ml-2 text-md ${colors[type]} whitespace-pre-wrap wrap-break-word`}
					>
						{title}
					</div>
				</div>
				{message ? (
					<div
						className={`ml-8 ${colors[type]} text-sm mt-1 whitespace-pre-wrap wrap-break-word`}
					>
						{message}
					</div>
				) : null}
			</div>
		);
	});
};

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = 'system' } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps['theme']}
			className="toaster group"
			icons={{
				success: (
					<CircleCheckIcon
						className="size-4 text-green-500"
						color="var(--color-green-500)"
					/>
				),
				info: <InfoIcon className="size-4" />,
				warning: (
					<TriangleAlertIcon
						className="size-4 text-amber-500"
						color="var(--color-amber-500)"
					/>
				),
				error: (
					<OctagonXIcon
						className="size-4 text-red-500"
						color="var(--color-red-500)"
					/>
				),
				loading: <Loader2Icon className="size-4 animate-spin" />,
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
				} as React.CSSProperties
			}
			position={props.position || 'top-right'}
			{...props}
		/>
	);
};

export { Toaster, toast, Toast };
