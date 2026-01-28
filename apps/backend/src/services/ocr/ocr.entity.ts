import { Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

export class Ocr {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	url: string;

	@Column()
	prompt: string;

	@CreateDateColumn({ type: 'timestamp' }) // 自动创建一个自增的时间戳
	createTime: Date;
}
