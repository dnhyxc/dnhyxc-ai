import { MigrationInterface, QueryRunner } from "typeorm";

export class LearningNoteAttachments1787557936862 implements MigrationInterface {
    name = 'LearningNoteAttachments1787557936862'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_learning_note_attachment\` (\`id\` varchar(36) NOT NULL, \`note_id\` varchar(36) NOT NULL, \`cos_key\` varchar(512) NOT NULL, \`url\` varchar(1024) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_elna_cos_key\` (\`cos_key\`), INDEX \`IDX_elna_note\` (\`note_id\`), UNIQUE INDEX \`UQ_elna_note_key\` (\`note_id\`, \`cos_key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_elna_note_key\` ON \`english_learning_note_attachment\``);
        await queryRunner.query(`DROP INDEX \`IDX_elna_note\` ON \`english_learning_note_attachment\``);
        await queryRunner.query(`DROP INDEX \`IDX_elna_cos_key\` ON \`english_learning_note_attachment\``);
        await queryRunner.query(`DROP TABLE \`english_learning_note_attachment\``);
    }

}
