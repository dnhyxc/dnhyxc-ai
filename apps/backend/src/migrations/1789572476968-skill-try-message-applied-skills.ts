import { MigrationInterface, QueryRunner } from "typeorm";

export class SkillTryMessageAppliedSkills1789572476968 implements MigrationInterface {
    name = 'SkillTryMessageAppliedSkills1789572476968'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`skill_try_messages\` ADD \`applied_skills\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`skill_try_messages\` DROP COLUMN \`applied_skills\``);
    }

}
