import { Button } from '@ui/button';
import { Toast } from '@ui/sonner';
import { CheckCircle, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isProtectedAccountUsername } from '@/constants';
import { useI18n } from '@/hooks';
import {
	createWechatLinkCode,
	fetchWechatStatus,
	unbindWechat,
	type WechatStatus,
} from '@/service';
import {
	getLoggedInUserInfoFromStorage,
	userScopedStorageKey,
} from '@/store/loggedInUserId';
import { copyToClipboard } from '@/utils/clipboard';

const LINK_SESSION_KEY = 'wechat_link_code';

type LinkSession = {
	linkCode: string;
	expiresAt: number;
};

function readLinkSession(): LinkSession | null {
	if (typeof window === 'undefined') return null;
	const raw = localStorage.getItem(userScopedStorageKey(LINK_SESSION_KEY));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as LinkSession;
		if (
			typeof parsed.linkCode === 'string' &&
			typeof parsed.expiresAt === 'number'
		) {
			return parsed;
		}
	} catch {
		// ignore
	}
	return null;
}

function writeLinkSession(session: LinkSession) {
	localStorage.setItem(
		userScopedStorageKey(LINK_SESSION_KEY),
		JSON.stringify(session),
	);
}

function clearLinkSession() {
	localStorage.removeItem(userScopedStorageKey(LINK_SESSION_KEY));
}

function remainingSeconds(expiresAt: number): number {
	return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

function clearLinkState(
	setLinkCode: (v: string) => void,
	setExpiresAt: (v: number) => void,
	setExpiresIn: (v: number) => void,
) {
	clearLinkSession();
	setLinkCode('');
	setExpiresAt(0);
	setExpiresIn(0);
}

export default function WechatBindPanel() {
	const { t } = useI18n();
	const [status, setStatus] = useState<WechatStatus>({ bound: false });
	const [linkCode, setLinkCode] = useState('');
	const [expiresAt, setExpiresAt] = useState(0);
	const [expiresIn, setExpiresIn] = useState(0);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const loadStatus = useCallback(async () => {
		try {
			const res = await fetchWechatStatus();
			if (res.success && res.data) {
				setStatus(res.data);
				if (res.data.bound) {
					clearLinkState(setLinkCode, setExpiresAt, setExpiresIn);
				}
			} else {
				setStatus({ bound: false });
			}
		} catch {
			setStatus({ bound: false });
		}
	}, []);

	useEffect(() => {
		void loadStatus();
	}, [loadStatus]);

	useEffect(() => {
		const session = readLinkSession();
		if (!session) return;
		const left = remainingSeconds(session.expiresAt);
		if (left <= 0) {
			clearLinkSession();
			return;
		}
		setLinkCode(session.linkCode);
		setExpiresAt(session.expiresAt);
		setExpiresIn(left);
	}, []);

	useEffect(() => {
		if (!linkCode || !expiresAt) return;
		const tick = () => {
			const left = remainingSeconds(expiresAt);
			setExpiresIn(left);
			if (left <= 0) {
				clearLinkState(setLinkCode, setExpiresAt, setExpiresIn);
			}
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [linkCode, expiresAt]);

	useEffect(() => {
		setCopied(false);
		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
	}, [linkCode]);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	async function onCreateCode() {
		const stored = getLoggedInUserInfoFromStorage();
		const username =
			typeof stored?.username === 'string' ? stored.username : undefined;
		if (isProtectedAccountUsername(username)) {
			Toast({
				type: 'warning',
				title: t('account.toast.testAccountForbidden'),
			});
			return;
		}
		setLoading(true);
		try {
			const res = await createWechatLinkCode();
			if (!res.success || !res.data?.link_code) {
				Toast({ type: 'error', title: t('account.wechat.codeFailed') });
				return;
			}
			const at = Date.now() + res.data.expires_in * 1000;
			setLinkCode(res.data.link_code);
			setExpiresAt(at);
			setExpiresIn(res.data.expires_in);
			writeLinkSession({ linkCode: res.data.link_code, expiresAt: at });
			Toast({ type: 'success', title: t('account.wechat.codeCreated') });
		} catch {
			// API 错误 Toast 由 http 层统一弹出（如「当前账号已关联微信」）
			await loadStatus();
		} finally {
			setLoading(false);
		}
	}

	async function onCopyCode() {
		if (!linkCode) return;
		try {
			await copyToClipboard(linkCode);
			setCopied(true);
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
			copyTimerRef.current = setTimeout(() => setCopied(false), 1600);
		} catch {
			Toast({ type: 'error', title: t('account.wechat.codeCopyFailed') });
		}
	}

	async function onUnbind() {
		const stored = getLoggedInUserInfoFromStorage();
		const username =
			typeof stored?.username === 'string' ? stored.username : undefined;
		if (isProtectedAccountUsername(username)) {
			Toast({
				type: 'warning',
				title: t('account.toast.testAccountForbidden'),
			});
			return;
		}
		setLoading(true);
		try {
			await unbindWechat();
			clearLinkState(setLinkCode, setExpiresAt, setExpiresIn);
			await loadStatus();
			Toast({ type: 'success', title: t('account.wechat.unbindSuccess') });
		} catch (err) {
			Toast({
				type: 'error',
				title:
					err instanceof Error ? err.message : t('account.wechat.unbindFailed'),
			});
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-8 pt-8 pb-4 border-t border-theme-border w-full max-w-xl">
			<div className="text-md font-semibold mb-3">
				{t('account.wechat.title')}
			</div>
			<p className="text-sm text-theme-auxiliary mb-3 max-w-xl">
				{t('account.wechat.hint')}
			</p>

			{status.bound ? (
				<div className="flex flex-col gap-4">
					<span className="text-sm pt-0.5">
						{t('account.wechat.bound', { id: status.openidMasked ?? '—' })}
					</span>
					<Button
						variant="outline"
						className="w-fit cursor-pointer"
						disabled={loading}
						onClick={() => void onUnbind()}
					>
						{t('account.wechat.unbind')}
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{linkCode ? (
						<div className="rounded-md bg-theme-secondary pt-0.5 inline-block">
							<div className="text-xs text-theme/60">
								{t('account.wechat.codeLabel', { seconds: expiresIn })}
							</div>
							<div className="inline-flex items-center gap-2">
								<div className="text-3xl font-mono tracking-widest">
									{linkCode}
								</div>
								<button
									type="button"
									className="text-theme-auxiliary hover:text-theme cursor-pointer"
									aria-label={
										copied ? t('account.wechat.codeCopied') : t('common.copy')
									}
									onClick={() => void onCopyCode()}
								>
									{copied ? (
										<CheckCircle size={18} className="text-teal-500" />
									) : (
										<Copy size={18} />
									)}
								</button>
							</div>
						</div>
					) : null}
					<Button
						className="w-fit cursor-pointer mt-1.5"
						disabled={loading}
						onClick={() => void onCreateCode()}
					>
						{linkCode
							? t('account.wechat.refreshCode')
							: t('account.wechat.createCode')}
					</Button>
				</div>
			)}
		</div>
	);
}
