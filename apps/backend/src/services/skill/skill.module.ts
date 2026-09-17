import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentSession } from '../agent/agent-session.entity';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { SkillService } from './skill.service';
import { SkillTrySession } from './skill-try-session.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Skill, SkillTrySession, AgentSession])],
	controllers: [SkillController],
	providers: [SkillService],
	exports: [SkillService],
})
export class SkillModule {}
