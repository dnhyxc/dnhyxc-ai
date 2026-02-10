## 对话分析

1. 一句话总结春天

```json
{
	"messages": {
		"currentId": "81b2c848-467b-4cdf-9bce-8b5a13e3aaaf",
		"2d3bbf29-aaee-4e41-893e-ddccb191a26d": {
			"id": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
			"parentId": null,
			"role": "user",
			"timestamp": 1770700069,
			"content": "一句话总结春天",
			"models": ["glm-4.7"],
			"childrenIds": ["99c2580c-b6bd-478b-92bb-c899ef0b800e"],
			"children": [
				{
					"99c2580c-b6bd-478b-92bb-c899ef0b800e": {
						"id": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
						"parentId": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
						"role": "assistant",
						"timestamp": 1770700069,
						"childrenIds": ["4c42e3c0-de83-4c94-95b6-de5fa88b8faf"],
						"children": [
							{
								"4c42e3c0-de83-4c94-95b6-de5fa88b8faf": {
									"id": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"role": "user",
									"timestamp": 1770700095,
									"childrenIds": ["eb7f9c3a-87da-476d-8895-7e10196db33c"],
									"children": [
										{
											"eb7f9c3a-87da-476d-8895-7e10196db33c": {
												"id": "eb7f9c3a-87da-476d-8895-7e10196db33c",
												"parentId": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
												"role": "assistant",
												"timestamp": 1770700095,
												"childrenIds": ["b22d54f2-ff9a-4acf-a1a2-9650fd51b959"],
												"children": [
													{
														"b22d54f2-ff9a-4acf-a1a2-9650fd51b959": {
															"id": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
															"parentId": "eb7f9c3a-87da-476d-8895-7e10196db33c",
															"role": "user",
															"timestamp": 1770700121,
															"childrenIds": [
																"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf"
															],
															"children": [
																{
																	"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf": {
																		"id": "81b2c848-467b-4cdf-9bce-8b5a13e3aaaf",
																		"parentId": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
																		"childrenIds": [],
																		"role": "assistant",
																		"timestamp": 1770700121
																	}
																}
															]
														}
													}
												]
											}
										}
									]
								}
							}
						]
					}
				}
			]
		}
	}
}
```

## 嵌套对话

```json
{
	"messages": {
		"2d3bbf29-aaee-4e41-893e-ddccb191a26d": {
			"id": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
			"parentId": null,
			"childrenIds": ["99c2580c-b6bd-478b-92bb-c899ef0b800e"],
			"role": "user",
			"timestamp": 1770700069,
			"content": "一句话总结春天",
			"models": ["glm-4.7"],
			"children": [
				{
					"99c2580c-b6bd-478b-92bb-c899ef0b800e": {
						"id": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
						"parentId": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
						"childrenIds": [
							"4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
							"18b2fbcb-1750-4f13-aed9-36a3abf8bac7"
						],
						"role": "assistant",
						"content": "春天是万物复苏、生机勃勃、充满希望的季节",
						"timestamp": 1770700069,
						"children": [
							{
								"4c42e3c0-de83-4c94-95b6-de5fa88b8faf": {
									"id": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["eb7f9c3a-87da-476d-8895-7e10196db33c"],
									"role": "user",
									"timestamp": 1770700095,
									"content": "一句话总结夏天",
									"children": [
										{
											"eb7f9c3a-87da-476d-8895-7e10196db33c": {
												"id": "eb7f9c3a-87da-476d-8895-7e10196db33c",
												"parentId": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
												"childrenIds": ["b22d54f2-ff9a-4acf-a1a2-9650fd51b959"],
												"role": "assistant",
												"content": "夏天是烈日炎炎、万物葱茏、热情奔放的季节。",
												"timestamp": 1770700095,
												"children": [
													{
														"b22d54f2-ff9a-4acf-a1a2-9650fd51b959": {
															"id": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
															"parentId": "eb7f9c3a-87da-476d-8895-7e10196db33c",
															"role": "user",
															"timestamp": 1770700121,
															"content": "一句话总结秋天",
															"childrenIds": [
																"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf"
															],
															"children": [
																{
																	"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf": {
																		"id": "81b2c848-467b-4cdf-9bce-8b5a13e3aaaf",
																		"parentId": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
																		"childrenIds": [],
																		"role": "assistant",
																		"timestamp": 1770700121,
																		"content": "秋天是秋高气爽、硕果累累、层林尽染的季节。"
																	}
																}
															]
														}
													}
												]
											}
										}
									]
								},
								"18b2fbcb-1750-4f13-aed9-36a3abf8bac7": {
									"id": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["70cd8c57-5463-4ed1-be3a-307f69ecd361"],
									"role": "user",
									"content": "一句话总结冬天",
									"timestamp": 1770726951,
									"children": [
										{
											"70cd8c57-5463-4ed1-be3a-307f69ecd361": {
												"id": "70cd8c57-5463-4ed1-be3a-307f69ecd361",
												"parentId": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
												"childrenIds": [],
												"role": "assistant",
												"timestamp": 1770726951,
												"content": "冬天是万物收藏、银装素裹、蓄势待发的季节。"
											}
										}
									]
								}
							}
						]
					}
				}
			]
		}
	},
	"currentId": "70cd8c57-5463-4ed1-be3a-307f69ecd361"
}
```

## 多层嵌套

```json
{
	"messages": {
		"2d3bbf29-aaee-4e41-893e-ddccb191a26d": {
			"id": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
			"parentId": null,
			"childrenIds": ["99c2580c-b6bd-478b-92bb-c899ef0b800e"],
			"role": "user",
			"timestamp": 1770700069,
			"content": "一句话总结春天",
			"models": ["glm-4.7"],
			"children": [
				{
					"99c2580c-b6bd-478b-92bb-c899ef0b800e": {
						"id": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
						"parentId": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
						"childrenIds": [
							"4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
							"18b2fbcb-1750-4f13-aed9-36a3abf8bac7"
						],
						"role": "assistant",
						"timestamp": 1770700069,
						"children": [
							{
								"4c42e3c0-de83-4c94-95b6-de5fa88b8faf": {
									"id": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["eb7f9c3a-87da-476d-8895-7e10196db33c"],
									"role": "user",
									"timestamp": 1770700095,
									"children": [
										{
											"eb7f9c3a-87da-476d-8895-7e10196db33c": {
												"id": "eb7f9c3a-87da-476d-8895-7e10196db33c",
												"parentId": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
												"childrenIds": ["b22d54f2-ff9a-4acf-a1a2-9650fd51b959"],
												"role": "assistant",
												"timestamp": 1770700095,
												"children": [
													{
														"b22d54f2-ff9a-4acf-a1a2-9650fd51b959": {
															"id": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
															"parentId": "eb7f9c3a-87da-476d-8895-7e10196db33c",
															"childrenIds": [
																"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf"
															],
															"role": "user",
															"timestamp": 1770700121,
															"children": [
																{
																	"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf": {
																		"id": "81b2c848-467b-4cdf-9bce-8b5a13e3aaaf",
																		"parentId": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
																		"childrenIds": [],
																		"role": "assistant",
																		"timestamp": 1770700121
																	}
																}
															]
														}
													}
												]
											}
										}
									]
								},
								"18b2fbcb-1750-4f13-aed9-36a3abf8bac7": {
									"id": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["70cd8c57-5463-4ed1-be3a-307f69ecd361"],
									"role": "user",
									"timestamp": 1770726951,
									"children": [
										{
											"70cd8c57-5463-4ed1-be3a-307f69ecd361": {
												"id": "70cd8c57-5463-4ed1-be3a-307f69ecd361",
												"parentId": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
												"childrenIds": [],
												"role": "assistant",
												"timestamp": 1770726951
											}
										}
									]
								}
							}
						]
					}
				}
			]
		},
		"1cd31c05-e9ee-407a-b96c-2ba2c0f9c848": {
			"id": "1cd31c05-e9ee-407a-b96c-2ba2c0f9c848",
			"parentId": null,
			"childrenIds": ["d7d6017a-f23a-4db2-befb-9d63004827fe"],
			"role": "user",
			"timestamp": 1770732177,
			"content": "一句话总结春天的样子",
			"children": [
				{
					"d7d6017a-f23a-4db2-befb-9d63004827fe": {
						"id": "d7d6017a-f23a-4db2-befb-9d63004827fe",
						"parentId": "1cd31c05-e9ee-407a-b96c-2ba2c0f9c848",
						"childrenIds": [],
						"role": "assistant",
						"timestamp": 1770732177,
						"content": "春天是冰雪消融后的万物复苏，是一幅草长莺飞、生机盎然的画卷。"
					}
				}
			]
		}
	},
	"currentId": "d7d6017a-f23a-4db2-befb-9d63004827fe"
}
```

## 深层嵌套

```json
{
	"messages": {
		"currentId": "2c0bf124-b7d6-4bc6-bd5e-3b9abd817171",
		"1cd31c05-e9ee-407a-b96c-2ba2c0f9c848": {
			"id": "1cd31c05-e9ee-407a-b96c-2ba2c0f9c848",
			"parentId": null,
			"childrenIds": ["d7d6017a-f23a-4db2-befb-9d63004827fe"],
			"role": "user",
			"timestamp": 1770732177,
			"content": "一句话总结春天的样子",
			"children": [
				{
					"d7d6017a-f23a-4db2-befb-9d63004827fe": {
						"id": "d7d6017a-f23a-4db2-befb-9d63004827fe",
						"parentId": "1cd31c05-e9ee-407a-b96c-2ba2c0f9c848",
						"childrenIds": [],
						"role": "assistant",
						"timestamp": 1770732177,
						"content": "春天是冰雪消融后的万物复苏，是一幅草长莺飞、生机盎然的画卷。"
					}
				}
			]
		},
		"2d3bbf29-aaee-4e41-893e-ddccb191a26d": {
			"id": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
			"parentId": null,
			"childrenIds": ["99c2580c-b6bd-478b-92bb-c899ef0b800e"],
			"role": "user",
			"timestamp": 1770700069,
			"content": "一句话总结春天",
			"models": ["glm-4.7"],
			"children": [
				{
					"99c2580c-b6bd-478b-92bb-c899ef0b800e": {
						"id": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
						"parentId": "2d3bbf29-aaee-4e41-893e-ddccb191a26d",
						"childrenIds": [
							"4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
							"18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
							"de7a5baf-ce3d-4e1a-9e26-9e9800f4602b"
						],
						"role": "assistant",
						"timestamp": 1770700069,
						"content": "春天是万物复苏、生机勃勃、充满希望的季节。",
						"children": [
							{
								"4c42e3c0-de83-4c94-95b6-de5fa88b8faf": {
									"id": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["eb7f9c3a-87da-476d-8895-7e10196db33c"],
									"role": "user",
									"timestamp": 1770700095,
									"content": "一句话总结夏天",
									"children": [
										{
											"eb7f9c3a-87da-476d-8895-7e10196db33c": {
												"id": "eb7f9c3a-87da-476d-8895-7e10196db33c",
												"parentId": "4c42e3c0-de83-4c94-95b6-de5fa88b8faf",
												"childrenIds": ["b22d54f2-ff9a-4acf-a1a2-9650fd51b959"],
												"role": "assistant",
												"timestamp": 1770700095,
												"content": "夏天是烈日炎炎、万物葱茏、热情奔放的季节。",
												"children": [
													{
														"b22d54f2-ff9a-4acf-a1a2-9650fd51b959": {
															"id": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
															"parentId": "eb7f9c3a-87da-476d-8895-7e10196db33c",
															"childrenIds": [
																"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf"
															],
															"role": "user",
															"timestamp": 1770700121,
															"content": "一句话总结秋天",
															"children": [
																{
																	"81b2c848-467b-4cdf-9bce-8b5a13e3aaaf": {
																		"id": "81b2c848-467b-4cdf-9bce-8b5a13e3aaaf",
																		"parentId": "b22d54f2-ff9a-4acf-a1a2-9650fd51b959",
																		"childrenIds": [],
																		"role": "assistant",
																		"timestamp": 1770700121,
																		"content": "秋天是秋高气爽、硕果累累、层林尽染的季节。"
																	}
																}
															]
														}
													}
												]
											}
										}
									]
								},
								"18b2fbcb-1750-4f13-aed9-36a3abf8bac7": {
									"id": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["70cd8c57-5463-4ed1-be3a-307f69ecd361"],
									"role": "user",
									"timestamp": 1770726951,
									"content": "一句话总结冬天",
									"children": [
										{
											"70cd8c57-5463-4ed1-be3a-307f69ecd361": {
												"id": "70cd8c57-5463-4ed1-be3a-307f69ecd361",
												"parentId": "18b2fbcb-1750-4f13-aed9-36a3abf8bac7",
												"childrenIds": [],
												"role": "assistant",
												"timestamp": 1770726951,
												"content": "冬天是万物收藏、银装素裹、蓄势待发的季节。"
											}
										}
									]
								},
								"de7a5baf-ce3d-4e1a-9e26-9e9800f4602b": {
									"id": "de7a5baf-ce3d-4e1a-9e26-9e9800f4602b",
									"parentId": "99c2580c-b6bd-478b-92bb-c899ef0b800e",
									"childrenIds": ["2c0bf124-b7d6-4bc6-bd5e-3b9abd817171"],
									"role": "user",
									"timestamp": 1770734906,
									"content": "一句话总结冬天的样子",
									"children": [
										{
											"2c0bf124-b7d6-4bc6-bd5e-3b9abd817171": {
												"id": "2c0bf124-b7d6-4bc6-bd5e-3b9abd817171",
												"parentId": "de7a5baf-ce3d-4e1a-9e26-9e9800f4602b",
												"childrenIds": [],
												"role": "assistant",
												"timestamp": 1770734906,
												"content": "冬天是银装素裹、寒风凛冽、万籁俱寂的季节。"
											}
										}
									]
								}
							}
						]
					}
				}
			]
		}
	}
}
```

## 总结

1. 正常不修改的情况：

null <- parent user children -><- parent assistant children -><- parent user children -><- parent assistant children -> null

2. 修改非第一个 user 节点的情况：

- user -> assistant -> (user1) user2 -> assistant2

- user -> assistant -> user1 (user2) -> assistant1 -> user -> assistant
