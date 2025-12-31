// import { IsNotEmpty, IsNumber, IsString, Length } from 'class-validator';

import { IsNotEmpty } from 'class-validator';

export class GetUserDto {
	@IsNotEmpty({
		message: 'pageNo 不能为空',
	})
	pageNo: number;
	@IsNotEmpty({
		message: 'pageSize 不能为空',
	})
	pageSize: number;
	username?: string;
	role?: number;
	gender?: string;
}
