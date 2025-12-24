import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { register } from '@/server';

interface IProps {
	onRegister: (status?: boolean) => void;
}

const RegisterForm: React.FC<IProps> = ({ onRegister }) => {
	const formSchema = z.object({
		username: z.string().min(2, {
			message: '用户名至少输入两个字符',
		}),
		password: z
			.string()
			.trim()
			.min(8, { message: '密码至少输入8个字符' })
			.regex(
				/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
				{
					message: '密码必须包含英文、数字和特殊字符',
				},
			),
		// email: z
		// 	.string()
		// 	.trim()
		// 	.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: '',
			password: '',
			// email: '',
		},
	});

	// 2. Define a submit handler.
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		await register(values);
		onRegister(false);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormField
					control={form.control}
					name="username"
					render={({ field }) => (
						<FormItem className="w-90">
							<FormLabel className="text-md">用户名</FormLabel>
							<FormControl>
								<Input placeholder="请输入用户名" {...field} className="" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">密码</FormLabel>
							<FormControl>
								<Input type="password" placeholder="请输入密码" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				{/* <FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-md">邮箱地址</FormLabel>
							<FormControl>
								<Input placeholder="请输入邮箱地址" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/> */}
				<Button type="submit" className="cursor-pointer w-full mt-5">
					注册
				</Button>
			</form>
		</Form>
	);
};

export default RegisterForm;
