import { MigrationInterface, QueryRunner } from "typeorm";

export class EnglishLibraryItemsResume1787360581773 implements MigrationInterface {
    name = 'EnglishLibraryItemsResume1787360581773'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`english_library_items_resume\` (\`id\` varchar(36) NOT NULL, \`user_id\` int NOT NULL, \`library_kind\` varchar(16) NOT NULL, \`library_id\` varchar(36) NOT NULL, \`resume_offset\` int NOT NULL DEFAULT '0', \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`idx_elir_kind_library\` (\`library_kind\`, \`library_id\`), UNIQUE INDEX \`UQ_elir_user_kind_library\` (\`user_id\`, \`library_kind\`, \`library_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`UQ_elir_user_kind_library\` ON \`english_library_items_resume\``);
        await queryRunner.query(`DROP INDEX \`idx_elir_kind_library\` ON \`english_library_items_resume\``);
        await queryRunner.query(`DROP TABLE \`english_library_items_resume\``);
    }

}
