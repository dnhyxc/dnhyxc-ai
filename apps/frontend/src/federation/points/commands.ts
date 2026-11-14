import { playPreferred, stopAllPlayback } from '@/utils/speech';
import { pickEnglishLearningJsonFile } from '@/views/englishLearning/import/englishLearningImportFile';
import { TTS_CACHE_FOLDER } from '@/views/englishLearning/utils/ttsCacheFolder';
import { POINT } from './catalog';
import { bindPointCommand, openPoint } from './session';

// 朗读和开详解的入参不固定：插件可能传词字符串，也可能传带 word 的载荷
function wordOf(arg: unknown): string {
	// 纯字符串去掉首尾空白；只剩空白时后面会当成「没有词」
	if (typeof arg === 'string') return arg.trim();
	// 对象形态只认 word 字段，和词卡载荷、列表行用的是同一个键
	if (arg && typeof arg === 'object' && 'word' in arg) {
		// 先取出 word，类型还没确认，避免把数字或 null 直接送去朗读
		const word = (arg as { word?: unknown }).word;
		// 不是字符串就当成没有词，不把 [object Object] 送进 TTS 或抽屉
		return typeof word === 'string' ? word.trim() : '';
		// 结束 { word } 这一支，字符串已修剪，其它类型已变成空串
	}
	// 缺参、null，或对象里根本没有 word：两条命令都按无词处理
	return '';
}

// 词卡 play：插件不能直接调主站朗读，只能经这条命令读当前词
bindPointCommand(POINT.vocabCard, 'play', (arg) => {
	// 字符串和 { word } 收成同一个词条
	const word = wordOf(arg);
	// 空白词不发起合成；已完成的 Promise 让插件把这次当成正常结束，而不是播放失败
	if (!word) return Promise.resolve();
	// 会员优先云端、失败回本机；同一词的音频写入磁盘，下次不再合成
	return playPreferred(word, {
		// 合成结果落到磁盘缓存
		persistDisk: true,
		// 只进单词详解目录，不和语句、练习的语音缓存混在一起
		cacheFolder: TTS_CACHE_FOLDER.vocabDetail,
		// 结束这一次 playPreferred：缓存开关和目录只作用于当前词
	});
	// 结束 play 回调的注册，调用名固定为词卡点上的 play
});

// 词卡 stop：关抽屉或插件主动停读时调用，停掉当前正在播的声音
bindPointCommand(POINT.vocabCard, 'stop', () => {
	// 不按词过滤，本机和云端正在播的都停
	stopAllPlayback();
	// 结束 stop
});

// 词库 pickJsonFile：导入插件弹不出系统文件框，借主站选一个 JSON
bindPointCommand(
	POINT.vocabLibrary,
	'pickJsonFile',
	() =>
		// 取消得到 null；选了非 .json 会抛 accept，由插件自己接
		pickEnglishLearningJsonFile(),
	// 结束 pickJsonFile 的注册，选文件的结果原样交给插件
);

// 词库 openCard：列表里点开某个词的详解。插件可能还没下载，词先记在词卡抽屉槽上
bindPointCommand(POINT.vocabLibrary, 'openCard', (arg) => {
	// 没有词就不开抽屉，避免空详解盖住列表
	const word = wordOf(arg);
	// false 表示这次没打开；下面插件未启用时也是 false，插件不用区分两种原因
	if (!word) return false;
	// 固定打开 vocabDetail 的词卡抽屉。它未启用，或槽位对不上时，openPoint 返回 false
	return openPoint(POINT.vocabCard, 'vocabDetail', 'drawer', {
		// 详解只凭这个词取内容；音标和释义等由插件自己再读
		word,
		// list 表示从词库列表点开，不是词卡按钮。这条命令只打开，不会再次点击关掉
		source: 'list',
		// 结束 openPoint 的载荷；返回值就是词卡抽屉这次有没有打开
	});
	// 结束 openCard 回调的注册，调用名固定为词库点上的 openCard
});
