import { MigrationInterface, QueryRunner } from "typeorm";

export class LearningNotesPublic1785463760601 implements MigrationInterface {
    name = 'LearningNotesPublic1785463760601'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_learning_note\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX \`IDX_eln_public\` ON \`english_learning_note\` (\`is_public\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_eln_public\` ON \`english_learning_note\``);
        await queryRunner.query(`ALTER TABLE \`english_learning_note\` DROP COLUMN \`is_public\``);
    }

}
