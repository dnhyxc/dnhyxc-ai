import { MigrationInterface, QueryRunner } from "typeorm";

export class Day1781121948978 implements MigrationInterface {
    name = 'Day1781121948978'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`membership_payment_grant\` (\`id\` int NOT NULL AUTO_INCREMENT, \`grant_id\` varchar(255) NOT NULL, \`user_id\` int NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_c44a44b2c8dac8c27a66de5488\` (\`grant_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_c44a44b2c8dac8c27a66de5488\` ON \`membership_payment_grant\``);
        await queryRunner.query(`DROP TABLE \`membership_payment_grant\``);
    }

}
