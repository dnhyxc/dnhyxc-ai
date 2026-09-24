import { IntersectionType, OmitType } from '@nestjs/mapped-types';
import { MinimaxTtsDto } from './minimax-tts.dto';
import { TtsBatchTextsDto } from './tts-batch-texts.dto';

/** MiniMax 批量合成：texts[] + 单条音色参数（无 text） */
export class MinimaxTtsBatchDto extends IntersectionType(
	TtsBatchTextsDto,
	OmitType(MinimaxTtsDto, ['text'] as const),
) {}
