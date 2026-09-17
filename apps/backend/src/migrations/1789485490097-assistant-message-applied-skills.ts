import { MigrationInterface, QueryRunner } from "typeorm";

export class AssistantMessageAppliedSkills1789485490097 implements MigrationInterface {
    name = 'AssistantMessageAppliedSkills1789485490097'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` ADD \`applied_skills\` json NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`assistant_messages\` DROP COLUMN \`applied_skills\``);
    }

}
