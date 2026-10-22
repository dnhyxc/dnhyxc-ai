/**
 * 每日阅读手动生成的当前页状态。离开设置页不拆连接。
 * 刷新不记上次输出，这次生成在后台继续。
 */
import { makeAutoObservable, runInAction } from 'mobx';
import type { EnglishDailyReadingProfile } from '@/service';
import { stopEnglishDailyReading } from '@/service';
import {
	ENGLISH_LEARNING_DAILY_READING_MANUAL_ATTACH,
	ENGLISH_LEARNING_DAILY_READING_MANUAL_STREAM,
} from '@/service/api';
import {
	openDailyReadingStream,
	type ReadingFrame,
} from '@/utils/dailyReadingSse';
import { createStreamingMobxPatchScheduler } from '@/utils/scheduleStreamingMobxPatch';

class EnglishDailyReading {
	generating = false;
	text = '';
	seq = 0;
	error: string | null = null;
	paused = false;
	startedAt: number | null = null;
	elapsed = 0;
	tokens = 0;
	historyRev = 0;
	level: Exclude<EnglishDailyReadingProfile['level'], 'random'> | null = null;
	length: Exclude<EnglishDailyReadingProfile['length'], 'random'> | null = null;
	focus: Exclude<EnglishDailyReadingProfile['focus'], 'random'> | null = null;
	questions: 0 | 2 | 3 | null = null;
	/** 本帧已拼好的原文。界面只看 text，不订这个字段。 */
	private buf = '';
	private bufTokens = 0;
	private paint!: ReturnType<typeof createStreamingMobxPatchScheduler>;
	private gen = 0;
	private activeId: string | null = null;
	private failAttempt = 0;
	private userStop = false;
	private timer = 0;
	private reader: ((fromUser?: boolean) => void) | null = null;
	private ready: (() => void) | null = null;

	constructor() {
		makeAutoObservable<EnglishDailyReading, 'buf' | 'bufTokens' | 'paint'>(
			this,
			{
				buf: false,
				bufTokens: false,
				paint: false,
			},
		);
		this.paint = createStreamingMobxPatchScheduler(() => {
			runInAction(() => {
				this.text = this.buf;
				this.tokens = this.bufTokens;
			});
		});
	}

	get runId(): string | null {
		return this.activeId;
	}

	setOnReady(fn: (() => void) | null) {
		this.ready = fn;
	}

	clearError() {
		this.error = null;
	}

	startRun(themes: string[], profile: EnglishDailyReadingProfile) {
		if (this.generating) return;
		const runId = crypto.randomUUID();
		this.activeId = runId;
		this.paint.cancel();
		this.userStop = false;
		this.failAttempt = 0;
		this.generating = true;
		this.buf = '';
		this.bufTokens = 0;
		this.text = '';
		this.seq = 0;
		this.paused = false;
		this.error = null;
		this.startedAt = Date.now();
		this.elapsed = 0;
		this.tokens = 0;
		this.level = profile.level === 'random' ? null : profile.level;
		this.length = profile.length === 'random' ? null : profile.length;
		this.focus = profile.focus === 'random' ? null : profile.focus;
		this.questions = profile.questions === 'random' ? null : profile.questions;
		this.connect(ENGLISH_LEARNING_DAILY_READING_MANUAL_STREAM, {
			themes,
			profile,
			runId,
		});
	}

	private attachBody(): { runId: string; after: number } | null {
		if (!this.activeId) return null;
		return { runId: this.activeId, after: this.seq };
	}

	stopRun() {
		this.paint.flush();
		this.userStop = true;
		this.gen += 1;
		window.clearTimeout(this.timer);
		const runId = this.activeId ?? undefined;
		this.activeId = null;
		this.generating = false;
		this.paused = false;
		this.buf = '';
		this.bufTokens = 0;
		this.text = '';
		this.startedAt = null;
		this.elapsed = 0;
		this.tokens = 0;
		const abort = this.reader;
		this.reader = null;
		abort?.(true);
		void stopEnglishDailyReading({ silent: true, runId }).finally(() => {
			runInAction(() => {
				this.historyRev += 1;
			});
		});
	}

	resetOnUserSwitch() {
		this.stopRun();
		this.ready = null;
		this.error = null;
	}

	private connect(path: string, body: Record<string, unknown>) {
		const my = ++this.gen;
		const prev = this.reader;
		this.reader = null;
		prev?.(true);
		void openDailyReadingStream({
			path,
			body,
			onFrame: (frame) => {
				if (my !== this.gen) return;
				this.onFrame(frame);
			},
			onIncomplete: () => {
				if (my !== this.gen || this.userStop || !this.activeId) return;
				this.schedule(my);
			},
		}).then((abort) => {
			if (my !== this.gen) {
				abort(true);
				return;
			}
			this.reader = abort;
		});
	}

	private schedule(my: number) {
		const delay = Math.min(8000, 1000 * 2 ** this.failAttempt);
		this.failAttempt += 1;
		window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			if (my !== this.gen || this.userStop) return;
			const body = this.attachBody();
			if (!body) return;
			this.connect(ENGLISH_LEARNING_DAILY_READING_MANUAL_ATTACH, body);
		}, delay);
	}

	private takeText(frame: ReadingFrame) {
		if (typeof frame.seq === 'number' && frame.seq > this.seq) {
			this.seq = frame.seq;
		}
		if (typeof frame.tokens === 'number') this.bufTokens = frame.tokens;
		if (frame.type === 'reading.snapshot' || frame.type === 'reading.paused') {
			const next = frame.text ?? '';
			const replace =
				frame.type === 'reading.paused'
					? next.length > this.buf.length
					: Boolean(frame.reset) || next.length >= this.buf.length;
			if (replace) this.buf = next;
			return;
		}
		if (frame.type === 'reading.delta') this.buf += frame.text ?? '';
	}

	private onFrame(frame: ReadingFrame) {
		this.takeText(frame);
		if (frame.type === 'reading.snapshot' || frame.type === 'reading.delta') {
			this.failAttempt = 0;
			this.paint.schedule();
			return;
		}
		if (
			frame.type !== 'reading.paused' &&
			frame.type !== 'reading.error' &&
			frame.type !== 'reading.complete' &&
			frame.type !== 'reading.stopped'
		) {
			return;
		}
		this.paint.flush();
		if (frame.type === 'reading.paused') this.paused = true;
		if (frame.type === 'reading.error') {
			this.error = frame.message || '生成失败';
		}
		this.finish();
		if (frame.type === 'reading.complete') this.ready?.();
	}

	private finish() {
		if (this.startedAt) this.elapsed = Date.now() - this.startedAt;
		this.startedAt = null;
		this.generating = false;
		this.activeId = null;
		this.historyRev += 1;
		window.clearTimeout(this.timer);
		this.reader = null;
	}
}

export const englishDailyReadingStore = new EnglishDailyReading();
export default englishDailyReadingStore;
