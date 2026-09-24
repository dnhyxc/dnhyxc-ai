import { IntersectionType, OmitType } from '@nestjs/mapped-types';
import { EdgeTtsDto } from './edge-tts.dto';
import { TtsBatchTextsDto } from './tts-batch-texts.dto';

/** Edge 批量合成：texts[] + 单条音色参数（无 text） */
export class EdgeTtsBatchDto extends IntersectionType(
	TtsBatchTextsDto,
	OmitType(EdgeTtsDto, ['text'] as const),
) {}
