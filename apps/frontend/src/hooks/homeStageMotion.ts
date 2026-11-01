import { useEffect, useState } from 'react';
import { getValue, setValue } from '@/utils/store';

const TILT_KEY = 'homeStageTilt';
const CARD_TILT_KEY = 'homeStageCardTilt';

const DEFAULT_TILT = true;
const DEFAULT_CARD_TILT = false;

function asBool(v: unknown, fallback: boolean): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

/** 首页 StageCard 动效偏好（主题设置读写，首页消费） */
export function useHomeStageMotion() {
	const [tilt, setTilt] = useState(DEFAULT_TILT);
	const [cardTilt, setCardTilt] = useState(DEFAULT_CARD_TILT);

	useEffect(() => {
		void (async () => {
			setTilt(asBool(await getValue(TILT_KEY), DEFAULT_TILT));
			setCardTilt(asBool(await getValue(CARD_TILT_KEY), DEFAULT_CARD_TILT));
		})();
	}, []);

	const changeTilt = async (next: boolean) => {
		setTilt(next);
		await setValue(TILT_KEY, next);
	};

	const changeCardTilt = async (next: boolean) => {
		setCardTilt(next);
		await setValue(CARD_TILT_KEY, next);
	};

	return { tilt, cardTilt, changeTilt, changeCardTilt };
}
