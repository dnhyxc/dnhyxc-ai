import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
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

interface IProps {
	onForgetPwd: (status?: boolean) => void;
	onRegister: (status?: boolean) => void;
}

const ForgetPwdForm: React.FC<IProps> = ({ onForgetPwd, onRegister }) => {
	const formSchema = z.object({
		username: z.string().min(2, {
			message: '用户名至少输入两个字符',
		}),
		password: z
			.string()
			.min(8, { message: '密码至少输入8个字符' })
			.regex(
				/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/,
				{
					message: '密码必须包含英文、数字和特殊字符',
				},
			),
		email: z
			.string()
			.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '请输入合法的邮箱地址' }),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			username: '',
			password: '',
			email: '',
		},
	});

	// 2. Define a submit handler.
	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		console.log(values);
		onForgetPwd(false);
	};

	const goToLogin = () => {
		onForgetPwd(false);
		onRegister(false);
	};

	return (
		<Form {...form}>
			<form className="space-y-8">
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
				<FormField
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
				/>
				<div className="flex items-center justify-center w-90">
					<Button
						className="cursor-pointer mt-5 flex-1"
						onClick={form.handleSubmit(onSubmit)}
					>
						确定重置
					</Button>
					<Button
						variant="outline"
						className="cursor-pointer mt-5 flex-1 ml-4"
						onClick={goToLogin}
					>
						返回登录
					</Button>
				</div>
			</form>
		</Form>
	);
};

export default ForgetPwdForm;
