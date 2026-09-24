import { IntersectionType, OmitType } from '@nestjs/mapped-types';
import { TtsBatchTextsDto } from './tts-batch-texts.dto';
import { XfyunTtsDto } from './xfyun-tts.dto';

/** 讯飞批量合成：texts[] + 单条音色参数（无 text） */
export class XfyunTtsBatchDto extends IntersectionType(
	TtsBatchTextsDto,
	OmitType(XfyunTtsDto, ['text'] as const),
) {}
