import { IsNumber, IsOptional, IsString } from 'class-validator';

export class MessageDto {
	@IsString()
	sessionId: string;
}

export class HistoryDto {
	@IsNumber()
	@IsOptional()
	pageSize: number;

	@IsNumber()
	@IsOptional()
	pageNo: number;

	@IsString()
	@IsOptional()
	userId: string;
}
