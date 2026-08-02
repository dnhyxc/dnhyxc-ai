import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { collectRequestData } from '../services/logs/log-payload.util';
import { LogsService } from '../services/logs/logs.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SKIP_PREFIXES = [
	'/api/auth/createVerifyCode',
	'/api/auth/sendEmail',
	'/api/auth/sendResetPwdEmail',
	'/api/pay/webhook',
	'/api/logs/',
	'/api/health',
];

function attachResponseCapture(res: Response) {
	let body: unknown;
	const remember = (payload: unknown) => {
		if (body !== undefined) return;
		body = payload;
	};

	const origJson = res.json.bind(res);
	res.json = ((payload: unknown) => {
		remember(payload);
		return origJson(payload);
	}) as Response['json'];

	const origSend = res.send.bind(res);
	res.send = ((payload: unknown) => {
		remember(payload);
		return origSend(payload);
	}) as Response['send'];

	return () => body;
}

@Injectable()
export class OperationLogMiddleware implements NestMiddleware {
	constructor(private readonly logsService: LogsService) {}

	use(req: Request & { user?: any }, res: Response, next: NextFunction) {
		const method = (req.method || '').toUpperCase();
		const path = req.originalUrl?.split('?')[0] || req.url || '';

		if (
			WRITE_METHODS.has(method) &&
			!SKIP_PREFIXES.some((p) => path.startsWith(p)) &&
			!/sse|stream/i.test(path)
		) {
			const getResponseBody = attachResponseCapture(res);
			res.on('finish', () => {
				const userId = req.user?.userId ?? req.user?.id ?? null;
				this.logsService.createSafe({
					path,
					method,
					data: collectRequestData(req),
					responseData: getResponseBody(),
					result: res.statusCode || 0,
					userId: typeof userId === 'number' ? userId : null,
				});
			});
		}

		next();
	}
}
