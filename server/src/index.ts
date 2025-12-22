import AppDtatSource from '../ormconfig';
import { User } from './user/user.entity';

AppDtatSource.initialize()
	.then(async () => {
		const res = await AppDtatSource.manager.find(User);
		console.log('查询结果：', res);
	})
	.catch((error) => console.log(error));
