import { MigrationInterface, QueryRunner } from "typeorm";

export class Auth1781208831821 implements MigrationInterface {
    name = 'Auth1781208831821'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes_library\` ADD \`is_public\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX \`idx_evl_public\` ON \`english_vocabulary_library\` (\`is_public\`)`);
        await queryRunner.query(`CREATE INDEX \`idx_ecql_public\` ON \`english_classic_quotes_library\` (\`is_public\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`idx_ecql_public\` ON \`english_classic_quotes_library\``);
        await queryRunner.query(`DROP INDEX \`idx_evl_public\` ON \`english_vocabulary_library\``);
        await queryRunner.query(`ALTER TABLE \`english_classic_quotes_library\` DROP COLUMN \`is_public\``);
        await queryRunner.query(`ALTER TABLE \`english_vocabulary_library\` DROP COLUMN \`is_public\``);
    }

}
