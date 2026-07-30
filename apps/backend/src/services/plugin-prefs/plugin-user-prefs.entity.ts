import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 用户级插件上架偏好（enabled 插件 id 列表），每用户一行 */
@Entity('plugin_user_prefs')
export class PluginUserPrefs {
	@PrimaryColumn({ type: 'int', name: 'user_id' })
	userId!: number;

	/** 已上架的插件 id；空数组 = 全部关闭 */
	@Column({ name: 'enabled_ids', type: 'json' })
	enabledIds!: string[];

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
