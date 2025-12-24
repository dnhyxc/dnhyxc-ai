import { AuthGuard } from '@nestjs/passport';

export class JwtGuard extends AuthGuard('jwt') {
	// 这里如果不写 constructor super，默认会调用 super()
	constructor() {
		super();
	}
}
