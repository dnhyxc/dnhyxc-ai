export const DAILY_READING_QUEUE = 'english-daily-reading';

/** 定时篇槽位。手动篇用行 id，才能和当天这一篇并存。 */
export const DAY_SLOT = 'day';

export const PENDING_STALE_MS = 90_000;
export const FAIL_COOLDOWN_MS = 5_000;
/** 本轮自动失败上限，与队列 attempts 一致。 */
export const MAX_ATTEMPTS = 5;
/** 管理员补历史。0 留给今天和明天的自动任务。BullMQ 数字越小越先跑。 */
export const BACKFILL_PRIORITY = 10;
