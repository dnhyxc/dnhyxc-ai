import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { JwtGuard } from '../guards/jwt.guard';

@Controller('logs')
@UseGuards(JwtGuard, AdminGuard)
export class LogsController {
	@Get('/getLogs')
	getLogs() {
		return 'get logs';
	}
}
