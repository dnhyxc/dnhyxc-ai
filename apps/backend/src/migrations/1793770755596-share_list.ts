import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 空壳由 migration:create 生成；真实建表见 1793200000000-shares.ts。
 * 保留空 up/down，避免重复 CREATE（库中 shares 已存在时 generate 也会报 no changes）。
 */
export class ShareList1793770755596 implements MigrationInterface {
	name = 'ShareList1793770755596';

	public async up(_queryRunner: QueryRunner): Promise<void> {}

	public async down(_queryRunner: QueryRunner): Promise<void> {}
}
