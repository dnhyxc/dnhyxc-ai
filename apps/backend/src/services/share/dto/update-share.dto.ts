import { PartialType } from '@nestjs/swagger';
import { CreateShareDto } from './share.dto';

export class UpdateShareDto extends PartialType(CreateShareDto) {}
