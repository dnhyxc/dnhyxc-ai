// import { IsNotEmpty, IsNumber, IsString, Length } from 'class-validator';

export class GetUserDto {
	page: number;
	username?: string;
	limit?: number;
	role?: number;
	gender?: string;
}
