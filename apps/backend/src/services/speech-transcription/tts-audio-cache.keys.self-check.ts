/**
 * ponytail: key 纯函数自检 — npx ts-node -r tsconfig-paths/register …/tts-audio-cache.keys.self-check.ts
 */
import assert from 'node:assert/strict';
import {
	buildTtsEdgeMetaKey,
	buildTtsRedisKey,
	normalizeTtsText,
} from './tts-audio-cache.keys';

const base = buildTtsRedisKey({
	provider: 'edge',
	paramParts: ['en-US-AriaNeural', '+0%', '+0%', '+0Hz'],
	normalizedText: normalizeTtsText('hello world'),
});
const changedVoice = buildTtsRedisKey({
	provider: 'edge',
	paramParts: ['en-US-GuyNeural', '+0%', '+0%', '+0Hz'],
	normalizedText: normalizeTtsText('hello world'),
});
assert.notEqual(base, changedVoice, '改 voice 必须换 key');

const sameTextWs = buildTtsRedisKey({
	provider: 'edge',
	paramParts: ['en-US-AriaNeural', '+0%', '+0%', '+0Hz'],
	normalizedText: normalizeTtsText('  hello   world  '),
});
assert.equal(base, sameTextWs, '空白规范化后同句应同 key');
assert.match(base, /^tts:v1:edge:[a-f0-9]{64}:[a-f0-9]{64}$/);
assert.equal(
	buildTtsEdgeMetaKey(base),
	base.replace('tts:v1:edge:', 'tts:v1:edge:meta:'),
);

const mmA = buildTtsRedisKey({
	provider: 'minimax',
	paramParts: [
		'1',
		'speech-2.8-turbo',
		'v1',
		'1',
		'1',
		'0',
		'',
		'32000',
		'128000',
		'mp3',
		'1',
		'',
	],
	normalizedText: 'hi',
});
const mmB = buildTtsRedisKey({
	provider: 'minimax',
	paramParts: [
		'2',
		'speech-2.8-turbo',
		'v1',
		'1',
		'1',
		'0',
		'',
		'32000',
		'128000',
		'mp3',
		'1',
		'',
	],
	normalizedText: 'hi',
});
assert.notEqual(mmA, mmB, 'MiniMax 不同 userId 不得共享 L2');

console.log('tts-audio-cache.keys.self-check: ok');
