import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

// 批量添加 and where 条件工具
export const andWhereCondition = <T extends ObjectLiteral>(
	query: SelectQueryBuilder<T>,
	obj: Record<string, unknown>,
) => {
	// 后面的 .where() 会覆盖前面的 .where()
	// WHERE 1=1 AND...
	Object.keys(obj).forEach((key) => {
		if (obj[key]) {
			query.andWhere(`${key} = :${key}`, { [key]: obj[key] });
		}
	});
	return query;
};

// 批量添加 or where 条件工具
export const orWhereCondition = <T extends ObjectLiteral>(
	query: SelectQueryBuilder<T>,
	obj: Record<string, unknown>,
) => {
	// 后面的 .where() 会覆盖前面的 .where()
	// WHERE 1=1 OR...
	Object.keys(obj).forEach((key) => {
		if (obj[key]) {
			query.orWhere(`${key} = :${key}`, { [key]: obj[key] });
		}
	});
};
