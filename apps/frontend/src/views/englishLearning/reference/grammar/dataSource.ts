/**
 * 英语学习参考静态数据 — 语法
 */
import type { GrammarReference } from './types';

export const grammarDataSource = {
	title: '英语语法大全',
	description:
		'系统全面的英语语法参考，涵盖词法、句法、时态、语态、从句、非谓语等所有核心语法板块',
	parts: [
		{
			id: 'part1',
			title: '第一部分：词法 (Morphology)',
			description: '英语单词的形态变化和词类体系',
			chapters: [
				{
					id: 'ch1',
					title: '第一章：词类 (Parts of Speech)',
					sections: [
						{
							id: 's1.1',
							title: '1.1 名词 (Nouns)',
							content: '名词是表示人、事物、地点或抽象概念名称的词。',
							subsections: [
								{
									id: 's1.1.1',
									title: '1.1.1 名词的分类',
									points: [
										{
											name: '专有名词 (Proper Nouns)',
											description: '表示特定的人、地点、机构等，首字母大写',
											examples: [
												'China',
												'Beijing',
												'John',
												'the United Nations',
											],
											rules: [
												'专有名词前一般不加冠词',
												'由普通名词构成的专有名词前加 the，如 the Great Wall',
											],
										},
										{
											name: '普通名词 (Common Nouns)',
											description: '表示一类人或东西或是一个抽象概念的名称',
											subtypes: [
												{
													name: '个体名词 (Individual Nouns)',
													description: '表示某类人或东西中的个体',
													examples: ['book', 'student', 'desk', 'cat'],
												},
												{
													name: '集体名词 (Collective Nouns)',
													description: '表示一群人或事物的总称',
													examples: ['family', 'team', 'police', 'audience'],
													rules: [
														'有些集体名词既可表单数也可表复数，视语境而定',
														'family, team, class 等作为整体时用单数，指成员时用复数',
														'police, cattle, people 等通常作复数',
													],
												},
												{
													name: '物质名词 (Material Nouns)',
													description: '表示无法分为个体的实物',
													examples: ['water', 'air', 'iron', 'rice'],
													rules: [
														'物质名词一般不可数，前面不能加不定冠词',
														'表示数量时需用量词：a piece of, a glass of, a loaf of',
													],
												},
												{
													name: '抽象名词 (Abstract Nouns)',
													description: '表示动作、状态、品质、感情等抽象概念',
													examples: [
														'happiness',
														'freedom',
														'health',
														'information',
													],
													rules: [
														'抽象名词多数不可数',
														'部分抽象名词可具体化变为可数：a joy, a knowledge',
													],
												},
											],
										},
									],
								},
								{
									id: 's1.1.2',
									title: '1.1.2 名词的数',
									points: [
										{
											name: '规则复数',
											description: '大多数名词加 -s 或 -es 构成复数',
											rules: [
												'一般情况加 -s：book → books',
												'以 s, x, sh, ch 结尾加 -es：box → boxes',
												'以辅音字母 + y 结尾，变 y 为 i 加 -es：city → cities',
												'以 f 或 fe 结尾，变 f/fe 为 v 加 -es：knife → knives',
												'以 o 结尾，有生命加 -es：hero → heroes；无生命加 -s：photo → photos',
											],
										},
										{
											name: '不规则复数',
											description: '不遵循常规变化规则的名词复数形式',
											examples: [
												'man → men',
												'woman → women',
												'child → children',
												'tooth → teeth',
												'foot → feet',
												'mouse → mice',
												'goose → geese',
												'ox → oxen',
												'phenomenon → phenomena',
												'criterion → criteria',
												'analysis → analyses',
												'crisis → crises',
											],
											rules: [
												'单复数同形：sheep, deer, fish, species, series',
												'只有复数形式：clothes, scissors, glasses, trousers',
												'复合名词：mother-in-law → mothers-in-law',
											],
										},
										{
											name: '不可数名词的量化',
											description: '不可数名词不能直接用数字计数，需要借助量词',
											examples: [
												'a piece of advice (一条建议)',
												'a bar of chocolate (一块巧克力)',
												'a bottle of water (一瓶水)',
												'a loaf of bread (一条面包)',
												'a drop of rain (一滴雨)',
												'a grain of sand (一粒沙)',
											],
										},
									],
								},
								{
									id: 's1.1.3',
									title: '1.1.3 名词的所有格',
									points: [
										{
											name: "'s 所有格",
											description: '用于有生命的名词',
											rules: [
												"单数名词加 's：Tom's book",
												"以 s 结尾的复数名词只加 '：the students' books",
												"不以 s 结尾的复数名词加 's：children's toys",
												"并列名词各自所有加 's：Tom's and Mary's books（各自的书）",
												"并列名词共有只在最后一个加 's：Tom and Mary's book（共有的书）",
											],
										},
										{
											name: 'of 所有格',
											description: '用于无生命的名词',
											examples: [
												'the door of the room',
												'the capital of China',
												'the end of the story',
											],
										},
										{
											name: '双重所有格',
											description: "of + 's 结构，表示部分概念",
											examples: [
												"a friend of my father's",
												'some books of hers',
											],
											rules: [
												'被修饰的名词前通常有 a, some, any, no, this, that 等限定词',
												'不能说 a friend of my father（错误）',
											],
										},
									],
								},
								{
									id: 's1.1.4',
									title: '1.1.4 名词的功能',
									points: [
										{
											name: '作主语',
											examples: ['Knowledge is power.', 'The cat is sleeping.'],
										},
										{
											name: '作宾语',
											examples: ['I love music.', 'She gave him a gift.'],
										},
										{
											name: '作表语',
											examples: ['He is a teacher.', 'Time is money.'],
										},
										{
											name: '作定语',
											examples: [
												'a paper bag',
												'a water bottle',
												'the school library',
											],
										},
										{
											name: '作同位语',
											examples: [
												'Mr. Smith, our teacher, is kind.',
												'Beijing, the capital of China, is beautiful.',
											],
										},
										{
											name: '作状语',
											examples: [
												'He walked three miles.',
												'Wait a moment.',
												'She weighs 60 kilograms.',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.2',
							title: '1.2 冠词 (Articles)',
							content:
								'冠词是一种虚词，不能独立使用，只能附着在名词前帮助说明名词的含义。',
							subsections: [
								{
									id: 's1.2.1',
									title: '1.2.1 不定冠词 (a/an)',
									points: [
										{
											name: '基本用法',
											description: '表示泛指，用于单数可数名词前，表示"一个"',
											rules: [
												'a 用在以辅音音素开头的单词前：a book, a university',
												'an 用在以元音音素开头的单词前：an apple, an hour, an honest man',
												'注意看发音而非字母：a European (以/j/开头), an MP3 (以/em/开头)',
											],
										},
										{
											name: '主要用法',
											examples: [
												'I have a pen. (泛指一支笔)',
												'She is a doctor. (说明身份)',
												'Rome wasn\'t built in a day. (表示"每一"，相当于 per)',
												'A Mr. Smith called you. (表示"某一个")',
												'He works six days a week. (表示"每一")',
											],
										},
									],
								},
								{
									id: 's1.2.2',
									title: '1.2.2 定冠词 (the)',
									points: [
										{
											name: '基本用法',
											description: '表示特指，用于各类名词前',
											rules: [
												'用于上文提到过的人或物：I saw a cat. The cat was black.',
												'用于谈话双方都知道的人或物：Close the door, please.',
												'用于世界上独一无二的事物前：the sun, the moon, the earth',
												'用于序数词和最高级前：the first, the best',
												'用于某些专有名词前：the Pacific Ocean, the Great Wall',
												'用于形容词前表示一类人：the rich, the poor, the old',
												'用于西洋乐器名称前：play the piano, play the guitar',
											],
										},
										{
											name: '不用 the 的情况',
											rules: [
												'专有名词前（人名、地名等）：John, China, London',
												'抽象名词和物质名词前表示一般概念：Love is beautiful.',
												'三餐、球类、棋类前：have breakfast, play basketball, play chess',
												'季节、月份、星期前：in spring, in March, on Monday',
												'by + 交通方式：by bus, by train, by plane',
												'表示头衔、职务的名词前：He was elected president.',
												'某些固定搭配中：at home, at school, go to bed, in fact',
											],
										},
									],
								},
								{
									id: 's1.2.3',
									title: '1.2.3 零冠词 (不用冠词)',
									points: [
										{
											name: '零冠词的使用场合',
											rules: [
												'复数名词表示泛指：Dogs are loyal animals.',
												'不可数名词表示泛指：Water is essential for life.',
												'man 表示人类时：Man is mortal.',
												'称呼语前：Mom, Teacher, Doctor',
												'表示独一无二的职位或头衔：He became captain of the team.',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.3',
							title: '1.3 代词 (Pronouns)',
							content: '代词是代替名词或名词短语的词，避免重复。',
							subsections: [
								{
									id: 's1.3.1',
									title: '1.3.1 人称代词',
									points: [
										{
											name: '人称代词的格变化',
											description: '人称代词有主格、宾格和所有格之分',
											table: {
												headers: [
													'人称',
													'主格',
													'宾格',
													'形容词性物主',
													'名词性物主',
													'反身代词',
												],
												rows: [
													['第一人称单数', 'I', 'me', 'my', 'mine', 'myself'],
													[
														'第二人称单数',
														'you',
														'you',
														'your',
														'yours',
														'yourself',
													],
													[
														'第三人称单数(男)',
														'he',
														'him',
														'his',
														'his',
														'himself',
													],
													[
														'第三人称单数(女)',
														'she',
														'her',
														'her',
														'hers',
														'herself',
													],
													[
														'第三人称单数(物)',
														'it',
														'it',
														'its',
														'its',
														'itself',
													],
													[
														'第一人称复数',
														'we',
														'us',
														'our',
														'ours',
														'ourselves',
													],
													[
														'第二人称复数',
														'you',
														'you',
														'your',
														'yours',
														'yourselves',
													],
													[
														'第三人称复数',
														'they',
														'them',
														'their',
														'theirs',
														'themselves',
													],
												],
											},
											rules: [
												'主格作主语：She is a teacher.',
												'宾格作宾语：I like him.',
												'形容词性物主代词后接名词：This is my book.',
												'名词性物主代词独立使用：This book is mine.',
												'反身代词表示"自己"：He hurt himself.',
											],
										},
									],
								},
								{
									id: 's1.3.2',
									title: '1.3.2 指示代词',
									points: [
										{
											name: 'this/that, these/those',
											description: '用来指代或修饰名词',
											rules: [
												'this/these 指近处，that/those 指远处',
												'this/these 多指即将提到的事物',
												'that/those 多指上文提到过的事物',
												'打电话时用 this 介绍自己，用 that 询问对方：Is that John? This is Mary.',
												'that 可代替不可数名词或单数可数名词，those 代替复数名词，以避免重复',
											],
										},
										{
											name: 'such',
											description: '表示"这样的"，可作主语、宾语、定语',
											examples: [
												'Such is life.',
												'I have never seen such a beautiful place.',
												'Take such as you need.',
											],
										},
									],
								},
								{
									id: 's1.3.3',
									title: '1.3.3 不定代词',
									points: [
										{
											name: 'some/any',
											description: '表示"一些"',
											rules: [
												'some 多用于肯定句：I have some books.',
												'any 多用于否定句和疑问句：Do you have any questions?',
												'some 也可用于疑问句，表示期望肯定回答或请求：Would you like some tea?',
												'修饰可数名词单数时表示"某一个"：Some person is waiting for you.',
											],
										},
										{
											name: 'no/none/nothing/nobody/nowhere',
											description: '表示否定意义',
											rules: [
												'no = not any，直接修饰名词：I have no money.',
												'none 可单独使用，可接 of 短语：None of them came.',
												'nothing 表示"什么都没有"',
												'nobody/no one 表示"没有人"（谓语用单数）',
												'nowhere 表示"无处"',
											],
										},
										{
											name: 'every/everyone/everything/everywhere',
											description: '表示"每一个"，强调全体',
											rules: [
												'every 只作定语：Every student passed.',
												'everyone/everybody 作主语时谓语用单数',
												'every one（分开写）可接 of 短语：Every one of us was tired.',
											],
										},
										{
											name: 'each/every 的区别',
											description: '两者都表示"每个"，但有细微差别',
											rules: [
												'each 强调个体，可作主语、宾语、定语：Each student has a book.',
												'every 强调整体，只能作定语：Every student passed.',
												'each of + 复数名词/代词，谓语用单数：Each of them is here.',
											],
										},
										{
											name: 'both/all',
											description: 'both 指两者，all 指三者或以上',
											rules: [
												'both 作同位语时放在 be 动词后、实义动词前：They are both students.',
												'all 作同位语位置同 both',
												'both...and... 连接两个并列成分',
												'all 可接不可数名词：all the water',
											],
										},
										{
											name: 'either/neither',
											description:
												'either 表示"两者中任何一个"，neither 表示"两者都不"',
											rules: [
												'either...or... 表示"要么...要么..."',
												'neither...nor... 表示"既不...也不..."',
												'作主语时谓语用单数：Neither answer is correct.',
												'either 也可表示"也（不）"：I don\'t like it either.',
											],
										},
										{
											name: 'other/another/the other/others/the others',
											description: '表示"其他的"',
											table: {
												headers: ['词', '含义', '用法'],
												rows: [
													[
														'another',
														'另一个（三者以上中的任意一个）',
														'单数，可作宾语/定语',
													],
													['other', '其他的', '作定语，后接复数名词'],
													['the other', '两者中的另一个', '特指，单数或复数'],
													[
														'others',
														'其他人/物（泛指）',
														'相当于 other + 复数名词',
													],
													[
														'the others',
														'其余的全部（特指）',
														'相当于 the other + 复数名词',
													],
												],
											},
										},
										{
											name: 'one/ones',
											description: '代替上文出现过的可数名词，避免重复',
											rules: [
												"one 代替单数可数名词：I don't like this shirt. Show me a blue one.",
												'ones 代替复数可数名词：These books are boring. I want interesting ones.',
												'one 前可有修饰语：the red one, a better one',
												'one 不可代替不可数名词',
											],
										},
										{
											name: 'it 的用法',
											description: 'it 用法非常灵活',
											rules: [
												'代替上文提到的事物：I bought a book. It is interesting.',
												'指时间、天气、距离等：It is Monday. It is raining. It is far.',
												'作形式主语：It is important to learn English.',
												'作形式宾语：I find it easy to solve this problem.',
												'强调句型：It was Tom who broke the window.',
											],
										},
									],
								},
								{
									id: 's1.3.4',
									title: '1.3.4 疑问代词',
									points: [
										{
											name: 'who/whom/whose',
											description: 'who 作主语，whom 作宾语，whose 表示"谁的"',
											examples: [
												'Who is there?',
												'Whom did you meet?',
												'Whose book is this?',
											],
										},
										{
											name: 'which/what',
											description:
												'which 用于选择范围有限的情况，what 用于无限制的情况',
											examples: [
												'Which color do you prefer, red or blue?',
												'What do you want for dinner?',
											],
										},
									],
								},
								{
									id: 's1.3.5',
									title: '1.3.5 关系代词',
									description: '引导定语从句，在从句中充当主语、宾语或定语',
									points: [
										{
											name: 'who/whom/whose/that/which',
											table: {
												headers: ['关系代词', '先行词', '从句功能'],
												rows: [
													['who', '人', '主语/宾语'],
													['whom', '人', '宾语'],
													['whose', '人/物', '定语'],
													['which', '物', '主语/宾语'],
													['that', '人/物', '主语/宾语'],
												],
											},
											rules: [
												'that 可代替 who/whom/which，但在非限制性定语从句中不可用 that',
												'介词后只能用 which/whom，不能用 that',
												'先行词被 the only, the very, the same 修饰时用 that',
												'先行词是不定代词时用 that',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.4',
							title: '1.4 数词 (Numerals)',
							content: '表示数量或顺序的词。',
							subsections: [
								{
									id: 's1.4.1',
									title: '1.4.1 基数词 (Cardinal Numerals)',
									points: [
										{
											name: '基本基数词',
											table: {
												headers: ['数字', '英文', '数字', '英文'],
												rows: [
													['1', 'one', '11', 'eleven'],
													['2', 'two', '12', 'twelve'],
													['3', 'three', '13', 'thirteen'],
													['4', 'four', '14', 'fourteen'],
													['5', 'five', '15', 'fifteen'],
													['6', 'six', '16', 'sixteen'],
													['7', 'seven', '17', 'seventeen'],
													['8', 'eight', '18', 'eighteen'],
													['9', 'nine', '19', 'nineteen'],
													['10', 'ten', '20', 'twenty'],
												],
											},
										},
										{
											name: '大数表达',
											rules: [
												'21-99：十位和个位之间加连字符：twenty-one',
												'100-999：hundred 前加数字，后面接 and：two hundred and five',
												'千位以上：thousand, million, billion',
												'hundred, thousand, million, billion 不加 s：two thousand (不说 two thousands)',
											],
										},
										{
											name: '复数形式的特殊用法',
											rules: [
												'表示概数：hundreds of, thousands of, millions of',
												"表示几十年代：in the 1980s / in the 1980's",
												'表示几十岁：in his twenties (在他二十多岁时)',
											],
										},
									],
								},
								{
									id: 's1.4.2',
									title: '1.4.2 序数词 (Ordinal Numerals)',
									points: [
										{
											name: '基本序数词',
											description: '大多数序数词由基数词加 -th 构成',
											rules: [
												'第一：first, 第二：second, 第三：third',
												'第五：fifth (去 ve 加 fth), 第九：ninth (去 e 加 th), 第十二：twelfth',
												'以 -ty 结尾的词，变 y 为 ie 加 -th：twenty → twentieth',
												'多位数：只将最后一个数变为序数词：twenty-first',
											],
										},
										{
											name: '序数词的用法',
											rules: [
												'序数词前通常加 the：the first lesson',
												'表示编号时可用基数词：Lesson One = the First Lesson',
												'a/an + 序数词表示"又一次"：He tried a second time.',
											],
										},
									],
								},
								{
									id: 's1.4.3',
									title: '1.4.3 分数、小数和百分数',
									points: [
										{
											name: '分数',
											description: '分子用基数词，分母用序数词',
											rules: [
												'分子大于 1 时分母加 s：1/3 one third, 2/3 two thirds',
												'1/2 a/one half, 1/4 a/one quarter, 3/4 three quarters',
												'带分数：2 1/2 two and a half',
											],
										},
										{
											name: '小数',
											rules: [
												'小数点读 point：3.14 three point one four',
												'0 可读作 zero 或 nought 或 oh：0.5 zero point five',
											],
										},
										{
											name: '百分数',
											rules: [
												'percent 读作 per cent：50% fifty per cent',
												'谓语动词形式取决于 of 后的名词：50% of the students are...',
											],
										},
									],
								},
								{
									id: 's1.4.4',
									title: '1.4.4 时间的表达',
									points: [
										{
											name: '年月日',
											rules: [
												'年份：2024 读作 twenty twenty-four',
												'月份：in January, in March',
												'日期：on May 1st, on the first of May',
												'完整日期：on May 1st, 2024',
											],
										},
										{
											name: '时刻',
											rules: [
												"整点：at 8 o'clock",
												'半点：at half past eight / at eight thirty',
												'一刻钟：at a quarter past eight / at eight fifteen',
												'差几分：at ten to eight / at seven fifty',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.5',
							title: '1.5 形容词 (Adjectives)',
							content: '形容词用来修饰名词或代词，说明其性质、状态或特征。',
							subsections: [
								{
									id: 's1.5.1',
									title: '1.5.1 形容词的分类',
									points: [
										{
											name: '品质形容词',
											description: '表示人或物的品质特征',
											examples: [
												'brave',
												'honest',
												'kind',
												'clever',
												'beautiful',
											],
										},
										{
											name: '类属形容词',
											description: '表示属于哪一类',
											examples: [
												'financial',
												'chemical',
												'medical',
												'cultural',
											],
										},
										{
											name: '强调形容词',
											description: '起强调作用',
											examples: [
												'complete',
												'absolute',
												'entire',
												'total',
												'perfect',
											],
										},
										{
											name: '表语形容词',
											description: '只能作表语，不能作定语',
											examples: [
												'afraid',
												'alive',
												'alone',
												'asleep',
												'awake',
												'aware',
											],
											rules: [
												'alive 不能说 an alive man，要说 a living man',
												'afraid 不能说 an afraid boy，要说 a frightened boy',
											],
										},
									],
								},
								{
									id: 's1.5.2',
									title: '1.5.2 形容词的位置',
									points: [
										{
											name: '前置定语',
											description: '形容词放在名词前',
											rules: [
												'多个形容词修饰同一名词时的顺序：',
												'限定词 → 数量 → 性质/品质 → 大小/形状 → 新旧 → 颜色 → 产地 → 材料 → 用途',
												'例：a beautiful old Italian leather bag',
											],
										},
										{
											name: '后置定语',
											description: '形容词放在名词后',
											rules: [
												'修饰不定代词时后置：something important, nothing special',
												'带介词短语或不定式时后置：a room full of people, a book easy to read',
												'表语形容词作定语时后置：the boy asleep',
											],
										},
									],
								},
								{
									id: 's1.5.3',
									title: '1.5.3 形容词的比较级和最高级',
									points: [
										{
											name: '规则变化',
											table: {
												headers: ['变化规则', '原级', '比较级', '最高级'],
												rows: [
													['一般加 -er/-est', 'tall', 'taller', 'tallest'],
													['以 e 结尾加 -r/-st', 'large', 'larger', 'largest'],
													[
														'辅音+y 变 y 为 i 加 -er/-est',
														'happy',
														'happier',
														'happiest',
													],
													[
														'重读闭音节双写末尾辅音加 -er/-est',
														'big',
														'bigger',
														'biggest',
													],
													[
														'多音节词前加 more/most',
														'beautiful',
														'more beautiful',
														'most beautiful',
													],
												],
											},
										},
										{
											name: '不规则变化',
											table: {
												headers: ['原级', '比较级', '最高级'],
												rows: [
													['good/well', 'better', 'best'],
													['bad/badly/ill', 'worse', 'worst'],
													['many/much', 'more', 'most'],
													['little', 'less', 'least'],
													['far', 'farther/further', 'farthest/furthest'],
													['old', 'older/elder', 'oldest/eldest'],
													['late', 'later/latter', 'latest/last'],
												],
											},
										},
										{
											name: '比较级的用法',
											rules: [
												'比较级 + than：He is taller than me.',
												'the + 比较级 + of the two：He is the taller of the two.',
												"比较级 + and + 比较级：It's getting colder and colder.",
												'the + 比较级, the + 比较级：The harder you work, the luckier you get.',
												'倍数 + 比较级 + than：This room is twice larger than that one.',
											],
										},
										{
											name: '最高级的用法',
											rules: [
												'the + 最高级 + (名词) + of/in：He is the tallest in the class.',
												'one of the + 最高级 + 复数名词：It is one of the best movies.',
												'最高级前可用序数词修饰：The Yellow River is the second longest river in China.',
											],
										},
										{
											name: '比较级修饰语',
											rules: [
												'much, a lot, far, a great deal, a bit, a little, slightly, even, still 等可修饰比较级',
												'very 不能修饰比较级，但可用 much 代替：much better (不说 very better)',
											],
										},
									],
								},
								{
									id: 's1.5.4',
									title: '1.5.4 常见形容词搭配',
									points: [
										{
											name: 'be + adj. + 介词',
											examples: [
												'be good at (擅长)',
												'be afraid of (害怕)',
												'be interested in (对...感兴趣)',
												'be famous for (因...而闻名)',
												'be fond of (喜欢)',
												'be proud of (以...为自豪)',
												'be strict with (对...严格)',
												'be popular with (受...欢迎)',
												'be satisfied with (对...满意)',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.6',
							title: '1.6 副词 (Adverbs)',
							content:
								'副词修饰动词、形容词、其他副词或全句，表示时间、地点、程度、方式等。',
							subsections: [
								{
									id: 's1.6.1',
									title: '1.6.1 副词的分类',
									points: [
										{
											name: '时间副词',
											examples: [
												'now',
												'then',
												'yesterday',
												'today',
												'tomorrow',
												'soon',
												'recently',
												'already',
												'yet',
												'just',
											],
										},
										{
											name: '地点副词',
											examples: [
												'here',
												'there',
												'everywhere',
												'nowhere',
												'outside',
												'inside',
												'upstairs',
												'downstairs',
												'abroad',
												'home',
											],
										},
										{
											name: '方式副词',
											description: '大多由形容词 + ly 构成',
											examples: [
												'quickly',
												'carefully',
												'happily',
												'slowly',
												'hard',
												'well',
												'fast',
											],
										},
										{
											name: '程度副词',
											examples: [
												'very',
												'quite',
												'rather',
												'fairly',
												'pretty',
												'too',
												'enough',
												'almost',
												'nearly',
												'hardly',
												'scarcely',
											],
										},
										{
											name: '频率副词',
											examples: [
												'always',
												'usually',
												'often',
												'sometimes',
												'occasionally',
												'rarely',
												'seldom',
												'never',
											],
											rules: [
												'频率副词在句中的位置：be 动词后，实义动词前',
												'频率由高到低：always > usually > often > sometimes > seldom > never',
											],
										},
										{
											name: '疑问副词',
											description: '引导特殊疑问句',
											examples: ['when', 'where', 'why', 'how'],
										},
										{
											name: '连接副词',
											description: '连接句子或从句，表示逻辑关系',
											examples: [
												'however',
												'therefore',
												'moreover',
												'furthermore',
												'nevertheless',
												'meanwhile',
												'otherwise',
												'besides',
												'thus',
											],
										},
										{
											name: '关系副词',
											description: '引导定语从句',
											examples: ['when (时间)', 'where (地点)', 'why (原因)'],
										},
										{
											name: '句子副词',
											description: '修饰整个句子，表示说话人的态度',
											examples: [
												'fortunately',
												'unfortunately',
												'obviously',
												'surprisingly',
												'honestly',
												'frankly',
												'generally',
											],
										},
									],
								},
								{
									id: 's1.6.2',
									title: '1.6.2 副词的比较级和最高级',
									points: [
										{
											name: '规则变化',
											rules: [
												'-ly 副词前加 more/most：more carefully, most carefully',
												'与形容词同形的副词加 -er/-est：hard → harder → hardest',
												'少数不规则：well → better → best, badly → worse → worst, little → less → least',
											],
										},
									],
								},
								{
									id: 's1.6.3',
									title: '1.6.3 副词的位置',
									points: [
										{
											name: '副词在句中的位置规则',
											rules: [
												'方式副词通常放在宾语后：He speaks English fluently.',
												'频率副词放在 be 动词后、实义动词前：She is always late. / I often go there.',
												'程度副词放在所修饰的词前：very good, quite beautiful',
												'时间/地点副词通常放在句末：I will see you tomorrow.',
												'否定副词 never, hardly, seldom 放在实义动词前：I never saw him again.',
											],
										},
									],
								},
								{
									id: 's1.6.4',
									title: '1.6.4 易混淆的副词',
									points: [
										{
											name: 'very/much/quite/rather/fairly 的区别',
											rules: [
												'very：修饰形容词/副词原级：very good',
												'much：修饰比较级/动词：much better, like it much',
												'quite：程度较强，"相当"：quite good',
												'rather：常修饰贬义或出乎意料的词：rather cold, rather good (出乎意料的好)',
												'fairly：程度较弱，"还算"：fairly good',
											],
										},
										{
											name: 'hard/hardly',
											rules: [
												'hard：努力地（副词）/ 硬的（形容词）',
												'hardly：几乎不（否定词）：I can hardly believe it.',
											],
										},
										{
											name: 'late/lately',
											rules: [
												'late：迟到/晚（副词/形容词）',
												'lately：最近（= recently）',
											],
										},
										{
											name: 'near/nearly',
											rules: [
												'near：近（空间/时间）',
												'nearly：几乎（= almost）',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.7',
							title: '1.7 介词 (Prepositions)',
							content:
								'介词是表示名词/代词与其他词之间关系的词，通常表示时间、地点、方向、原因等。',
							subsections: [
								{
									id: 's1.7.1',
									title: '1.7.1 时间介词',
									points: [
										{
											name: 'at/on/in 表示时间',
											rules: [
												"at + 具体时刻/节日：at 8 o'clock, at noon, at Christmas",
												'on + 具体某一天/星期：on Monday, on May 1st, on a cold morning',
												'in + 月/年/季节/较长时段：in January, in 2024, in spring, in the morning',
											],
										},
										{
											name: 'before/after/since/until/till',
											rules: [
												"before + 具体时间：before 8 o'clock",
												'after + 具体时间：after lunch',
												'since + 过去时间点（与完成时连用）：since 2020, since yesterday',
												"until/till + 时间点：wait until 5 o'clock",
											],
										},
										{
											name: 'during/for/throughout',
											rules: [
												'during + 名词：during the meeting, during the holiday',
												'for + 时间段（与完成时连用）：for two years, for a long time',
												'throughout + 时间段：throughout the day (整天)',
											],
										},
										{
											name: 'by/before/in + 时间',
											rules: [
												'by + 时间点（不迟于）：finish by Friday',
												'before + 时间点（在...之前）：arrive before noon',
												"in + 时间段（将来时中）：I'll be back in a week.",
											],
										},
									],
								},
								{
									id: 's1.7.2',
									title: '1.7.2 地点介词',
									points: [
										{
											name: 'at/on/in 表示地点',
											rules: [
												'at + 具体地点/小地点：at home, at school, at the bus stop',
												'on + 表面/线上：on the table, on the wall, on the left',
												'in + 大地点/封闭空间：in Beijing, in China, in the room, in the box',
											],
										},
										{
											name: 'over/above/under/below/beneath',
											rules: [
												'over：在正上方（有接触可能）：a bridge over the river',
												'above：在上方（不一定正对）：above sea level',
												'under：在正下方：under the table',
												'below：在下方（不一定正对）：below the surface',
												'beneath：在...下面（紧贴）：beneath the tree',
											],
										},
										{
											name: 'between/among',
											rules: [
												'between：两者之间：between you and me',
												'among：三者或以上之间：among the students',
											],
										},
										{
											name: 'in front of/behind/beside/next to/opposite',
											rules: [
												'in front of：在...前面（外部）',
												'behind：在...后面',
												'beside/next to：在...旁边',
												'opposite：在...对面',
											],
										},
										{
											name: 'into/out of/onto/off',
											rules: [
												'into：进入：walk into the room',
												'out of：从...出来：come out of the room',
												'onto：到...上面：jump onto the table',
												'off：从...离开：fall off the bike',
											],
										},
										{
											name: 'through/across/along/past',
											rules: [
												'through：从内部穿过：walk through the forest',
												'across：从表面穿过：swim across the river',
												'along：沿着：walk along the street',
												'past：经过：walk past the post office',
											],
										},
									],
								},
								{
									id: 's1.7.3',
									title: '1.7.3 方式、原因、其他介词',
									points: [
										{
											name: '方式介词',
											rules: [
												'by：通过...方式：by bus, by phone, by email',
												'with：使用工具：cut with a knife, write with a pen',
												'in：用...语言/材料：in English, written in ink',
											],
										},
										{
											name: '原因介词',
											rules: [
												'for：因为：Thank you for your help.',
												'because of：因为：The game was cancelled because of the rain.',
												'due to：由于：The delay was due to bad weather.',
												'owing to：由于：Owing to the rain, the match was postponed.',
												'thanks to：多亏：Thanks to your help, I passed the exam.',
											],
										},
										{
											name: '其他重要介词',
											rules: [
												"without：没有：I can't do it without you.",
												'despite/in spite of：尽管：Despite the rain, we went out.',
												'according to：根据：According to the weather forecast...',
												'except/besides：except（不包括）/ besides（包括）',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.8',
							title: '1.8 连词 (Conjunctions)',
							content: '连词连接词、短语、从句或句子，表示它们之间的逻辑关系。',
							subsections: [
								{
									id: 's1.8.1',
									title: '1.8.1 并列连词',
									points: [
										{
											name: '表示并列/递进',
											rules: [
												'and：和',
												'both...and...：既...又...',
												'not only...but also...：不但...而且...',
												'neither...nor...：既不...也不...',
												'as well as：也，和',
											],
										},
										{
											name: '表示转折',
											rules: [
												'but：但是',
												'yet：然而',
												'however：然而（副词，可独立使用）',
												'while：然而（连词）',
												'nevertheless：尽管如此',
											],
										},
										{
											name: '表示选择',
											rules: [
												'or：或者',
												'either...or...：要么...要么...',
												'neither...nor...：既不...也不...',
												'or else：否则',
											],
										},
										{
											name: '表示因果',
											rules: ['for：因为（并列连词，较正式）', 'so：所以'],
										},
									],
								},
								{
									id: 's1.8.2',
									title: '1.8.2 从属连词',
									points: [
										{
											name: '引导时间状语从句',
											rules: [
												'when：当...时',
												'while：在...期间',
												'before：在...之前',
												'after：在...之后',
												'since：自从',
												'until/till：直到',
												'as soon as：一...就...',
												'once：一旦',
											],
										},
										{
											name: '引导原因状语从句',
											rules: [
												'because：因为（语气最强）',
												'since：既然（已知原因）',
												'as：因为（语气较弱）',
												'now that：既然',
											],
										},
										{
											name: '引导条件状语从句',
											rules: [
												'if：如果',
												'unless：除非（= if not）',
												'as long as：只要',
												'once：一旦',
												'provided that：假如',
												'suppose/supposing that：假设',
											],
										},
										{
											name: '引导让步状语从句',
											rules: [
												'although/though：虽然（不能与 but 同用）',
												'even though：即使',
												'while：虽然/尽管',
												'no matter + wh-：无论...',
												'whatever/whoever/whenever/wherever/however',
											],
										},
										{
											name: '引导目的状语从句',
											rules: ['so that：以便', 'in order that：为了'],
										},
										{
											name: '引导结果状语从句',
											rules: [
												'so...that...：如此...以至于...',
												'such...that...：如此...以至于...',
												'so that：结果是',
											],
										},
										{
											name: '引导方式状语从句',
											rules: [
												'as：按照...方式',
												'as if / as though：好像，仿佛',
											],
										},
									],
								},
							],
						},
						{
							id: 's1.9',
							title: '1.9 感叹词 (Interjections)',
							content: '表示惊讶、快乐、痛苦等强烈情感的词。',
							points: [
								{
									name: '常见感叹词',
									examples: [
										'Oh!',
										'Ah!',
										'Wow!',
										'Ouch!',
										'Alas!',
										'Well!',
										'Hello!',
										'Goodbye!',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch2',
					title: '第二章：动词与动词短语 (Verbs and Phrasal Verbs)',
					sections: [
						{
							id: 's2.1',
							title: '2.1 动词的分类',
							subsections: [
								{
									id: 's2.1.1',
									title: '2.1.1 实义动词、连系动词、助动词和情态动词',
									points: [
										{
											name: '实义动词 (Notional Verbs)',
											description: '有实际意义，表示动作或状态',
											subtypes: [
												{
													name: '及物动词 (vt.)',
													description: '后接宾语',
													examples: ['I love music.', 'She bought a book.'],
												},
												{
													name: '不及物动词 (vi.)',
													description: '后不接宾语',
													examples: [
														'He runs fast.',
														'The sun rises in the east.',
													],
												},
												{
													name: '兼作及物和不及物',
													description: '根据语境决定',
													examples: [
														"I can't eat. / I eat an apple every day.",
														'She sings well. / She sings a song.',
													],
												},
											],
										},
										{
											name: '连系动词 (Linking Verbs)',
											description: '连接主语和表语，说明主语的身份、特征或状态',
											subtypes: [
												{
													name: '状态类',
													examples: [
														'be',
														'seem',
														'appear',
														'keep',
														'remain',
														'stay',
														'lie',
														'stand',
													],
												},
												{
													name: '变化类',
													examples: [
														'become',
														'get',
														'grow',
														'turn',
														'go',
														'come',
														'fall',
														'run',
														'make',
													],
												},
												{
													name: '感官类',
													examples: ['look', 'sound', 'smell', 'taste', 'feel'],
												},
												{
													name: '规则',
													text: '连系动词后接形容词作表语，不接副词：The food tastes good. (不说 The food tastes well.)',
												},
											],
										},
										{
											name: '助动词 (Auxiliary Verbs)',
											description:
												'帮助实义动词构成各种时态、语态、疑问句和否定句',
											rules: [
												'be：构成进行时和被动语态',
												'do/does/did：构成疑问句、否定句、强调句',
												'have/has/had：构成完成时',
												'shall/should, will/would：构成将来时',
											],
										},
										{
											name: '情态动词 (Modal Verbs)',
											description: '表示能力、许可、义务、推测等情态意义',
											table: {
												headers: ['情态动词', '含义', '例句'],
												rows: [
													[
														'can/could',
														'能力、许可、推测',
														'I can swim. / Can I go?',
													],
													[
														'may/might',
														'许可、推测',
														'May I come in? / It may rain.',
													],
													[
														'must',
														'必须、推测',
														'You must finish it. / He must be tired.',
													],
													[
														'shall',
														'征求意见、承诺',
														'Shall we go? / You shall have it.',
													],
													['should/ought to', '应该', 'You should study hard.'],
													[
														'will/would',
														'意愿、推测、习惯',
														'Will you help me? / He would sit there for hours.',
													],
													['need', '需要', "Need I go? / You needn't worry."],
													['dare', '敢', 'How dare you say that!'],
												],
											},
											rules: [
												'情态动词后接动词原形',
												'没有人称和数的变化（第三人称单数不加 s）',
												'不能单独作谓语',
												"must 表示推测时只用于肯定句，否定推测用 can't",
											],
										},
									],
								},
							],
						},
						{
							id: 's2.2',
							title: '2.2 动词的基本形式',
							points: [
								{
									name: '动词的五种基本形式',
									table: {
										headers: [
											'原形',
											'第三人称单数',
											'过去式',
											'过去分词',
											'现在分词',
										],
										rows: [
											['work', 'works', 'worked', 'worked', 'working'],
											['go', 'goes', 'went', 'gone', 'going'],
											['write', 'writes', 'wrote', 'written', 'writing'],
										],
									},
								},
								{
									name: '规则变化',
									rules: [
										'一般加 -s/-es：work → works',
										'以 s, x, sh, ch, o 结尾加 -es：go → goes',
										'辅音 + y 变 y 为 i 加 -es：study → studies',
										'一般加 -ed：work → worked',
										'以 e 结尾加 -d：like → liked',
										'辅音 + y 变 y 为 i 加 -ed：study → studied',
										'重读闭音节双写末尾辅音加 -ed：stop → stopped',
										'一般加 -ing：work → working',
										'以不发音 e 结尾去 e 加 -ing：make → making',
										'重读闭音节双写加 -ing：run → running',
										'以 ie 结尾变 ie 为 y 加 -ing：die → dying',
									],
								},
								{
									name: '常见不规则动词表',
									table: {
										headers: ['原形', '过去式', '过去分词'],
										rows: [
											['be', 'was/were', 'been'],
											['begin', 'began', 'begun'],
											['break', 'broke', 'broken'],
											['bring', 'brought', 'brought'],
											['build', 'built', 'built'],
											['buy', 'bought', 'bought'],
											['catch', 'caught', 'caught'],
											['choose', 'chose', 'chosen'],
											['come', 'came', 'come'],
											['do', 'did', 'done'],
											['draw', 'drew', 'drawn'],
											['drink', 'drank', 'drunk'],
											['drive', 'drove', 'driven'],
											['eat', 'ate', 'eaten'],
											['fall', 'fell', 'fallen'],
											['feel', 'felt', 'felt'],
											['find', 'found', 'found'],
											['fly', 'flew', 'flown'],
											['forget', 'forgot', 'forgotten'],
											['forgive', 'forgave', 'forgiven'],
											['freeze', 'froze', 'frozen'],
											['get', 'got', 'got/gotten'],
											['give', 'gave', 'given'],
											['go', 'went', 'gone'],
											['grow', 'grew', 'grown'],
											['have', 'had', 'had'],
											['hear', 'heard', 'heard'],
											['hide', 'hid', 'hidden'],
											['hit', 'hit', 'hit'],
											['hold', 'held', 'held'],
											['keep', 'kept', 'kept'],
											['know', 'knew', 'known'],
											['leave', 'left', 'left'],
											['lend', 'lent', 'lent'],
											['let', 'let', 'let'],
											['lie', 'lay', 'lain'],
											['lose', 'lost', 'lost'],
											['make', 'made', 'made'],
											['mean', 'meant', 'meant'],
											['meet', 'met', 'met'],
											['pay', 'paid', 'paid'],
											['put', 'put', 'put'],
											['read', 'read', 'read'],
											['ride', 'rode', 'ridden'],
											['ring', 'rang', 'rung'],
											['rise', 'rose', 'risen'],
											['run', 'ran', 'run'],
											['say', 'said', 'said'],
											['see', 'saw', 'seen'],
											['sell', 'sold', 'sold'],
											['send', 'sent', 'sent'],
											['set', 'set', 'set'],
											['shake', 'shook', 'shaken'],
											['show', 'showed', 'shown'],
											['shut', 'shut', 'shut'],
											['sing', 'sang', 'sung'],
											['sit', 'sat', 'sat'],
											['sleep', 'slept', 'slept'],
											['speak', 'spoke', 'spoken'],
											['spend', 'spent', 'spent'],
											['stand', 'stood', 'stood'],
											['steal', 'stole', 'stolen'],
											['swim', 'swam', 'swum'],
											['take', 'took', 'taken'],
											['teach', 'taught', 'taught'],
											['tear', 'tore', 'torn'],
											['tell', 'told', 'told'],
											['think', 'thought', 'thought'],
											['throw', 'threw', 'thrown'],
											['understand', 'understood', 'understood'],
											['wake', 'woke', 'woken'],
											['wear', 'wore', 'worn'],
											['win', 'won', 'won'],
											['write', 'wrote', 'written'],
										],
									},
								},
							],
						},
						{
							id: 's2.3',
							title: '2.3 短语动词 (Phrasal Verbs)',
							content: '由动词 + 介词/副词构成的固定搭配，具有特定的含义。',
							points: [
								{
									name: '动词 + 副词（可拆分）',
									rules: [
										'宾语为名词时可放在副词前后：turn on the light / turn the light on',
										'宾语为代词时必须放在中间：turn it on (不说 turn on it)',
									],
									examples: [
										'turn on/off (打开/关闭)',
										'turn up/down (调高/调低)',
										'pick up (捡起/接人)',
										'put on/take off (穿上/脱下)',
										'give up (放弃)',
										'find out (发现)',
										'look up (查阅)',
										'make up (编造/组成)',
										'work out (算出/锻炼)',
										'set up (建立)',
										'take off (起飞)',
										'break down (出故障)',
										'come across (偶然遇到)',
										'get along (相处)',
										'get over (克服)',
										'give away (赠送/泄露)',
										'go on (继续)',
										'hand in (上交)',
										'hang up (挂断)',
										'hold on (等一下)',
										'keep up (跟上)',
										'look after (照顾)',
										'look for (寻找)',
										'look forward to (期待)',
										'make out (辨认出)',
										'pass away (去世)',
										'point out (指出)',
										'put off (推迟)',
										'run out of (用完)',
										'show up (出现)',
										'take over (接管)',
										'think over (仔细考虑)',
										'try on (试穿)',
										'use up (用完)',
										'wake up (醒来)',
									],
								},
								{
									name: '动词 + 介词（不可拆分）',
									examples: [
										'look after (照顾)',
										'look for (寻找)',
										'look into (调查)',
										'look at (看)',
										'listen to (听)',
										'wait for (等待)',
										'ask for (请求)',
										'believe in (相信)',
										'belong to (属于)',
										'care for (关心)',
										'deal with (处理)',
										'depend on (依靠)',
										'dream of (梦想)',
										'hear from (收到来信)',
										'hear of (听说)',
										'insist on (坚持)',
										'pay for (付款)',
										'rely on (依赖)',
										'result in (导致)',
										'suffer from (遭受)',
										'worry about (担心)',
									],
								},
								{
									name: '动词 + 副词 + 介词',
									examples: [
										'look forward to (期待)',
										'get along with (与...相处)',
										'come up with (想出)',
										'catch up with (赶上)',
										'keep up with (跟上)',
										'put up with (忍受)',
										'run out of (用完)',
										'go on with (继续)',
										'look down upon (看不起)',
										'make up for (弥补)',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch3',
					title: '第三章：时态 (Tenses)',
					content: '英语共有 16 种时态，其中最常用的有 8 种。',
					sections: [
						{
							id: 's3.1',
							title: '3.1 一般现在时 (Simple Present)',
							points: [
								{
									name: '构成',
									rules: [
										'主语 + 动词原形（第三人称单数加 -s/-es）',
										"否定：主语 + don't/doesn't + 动词原形",
										'疑问：Do/Does + 主语 + 动词原形',
									],
								},
								{
									name: '用法',
									rules: [
										'表示经常性、习惯性的动作：I go to school every day.',
										'表示客观事实或普遍真理：The earth goes around the sun.',
										'表示按规定、计划要发生的动作：The train leaves at 8 tomorrow.',
										'在时间/条件状语从句中代替将来时：If it rains tomorrow, I will stay home.',
									],
								},
								{
									name: '时间标志词',
									examples: [
										'always',
										'usually',
										'often',
										'sometimes',
										'never',
										'every day/week/month/year',
										'on Mondays',
										'in the morning',
									],
								},
							],
						},
						{
							id: 's3.2',
							title: '3.2 一般过去时 (Simple Past)',
							points: [
								{
									name: '构成',
									rules: [
										'主语 + 动词过去式',
										"否定：主语 + didn't + 动词原形",
										'疑问：Did + 主语 + 动词原形',
									],
								},
								{
									name: '用法',
									rules: [
										'表示过去某个时间发生的动作或状态：I visited Paris last year.',
										'表示过去经常或反复发生的动作：He often went fishing when he was young.',
										'表示过去一连串动作：He got up, washed, had breakfast and went to school.',
									],
								},
								{
									name: '时间标志词',
									examples: [
										'yesterday',
										'last night/week/month/year',
										'... ago',
										'in 2020',
										'just now',
										'the other day',
										'at that time',
									],
								},
							],
						},
						{
							id: 's3.3',
							title: '3.3 一般将来时 (Simple Future)',
							points: [
								{
									name: '构成',
									rules: [
										'will/shall + 动词原形',
										'am/is/are going to + 动词原形',
										'am/is/are to + 动词原形',
										'am/is/are about to + 动词原形',
									],
								},
								{
									name: 'will 与 be going to 的区别',
									rules: [
										'will：表示意愿、预测、临时决定：I will help you. / It will rain tomorrow.',
										"be going to：表示计划、打算或有迹象表明即将发生：I'm going to visit my grandma. / Look at the clouds! It's going to rain.",
									],
								},
								{
									name: '其他将来表达',
									rules: [
										'be to + 动词原形：表示按计划/安排要发生的事',
										'be about to + 动词原形：表示即将发生的事（不接具体时间）',
										'be due to + 动词原形：表示预定要发生的事',
									],
								},
								{
									name: '时间标志词',
									examples: [
										'tomorrow',
										'next week/month/year',
										'in the future',
										'soon',
										'the day after tomorrow',
									],
								},
							],
						},
						{
							id: 's3.4',
							title: '3.4 过去将来时 (Simple Past Future)',
							points: [
								{
									name: '构成',
									rules: ['would + 动词原形', 'was/were going to + 动词原形'],
								},
								{
									name: '用法',
									rules: [
										'表示从过去某个时间看将要发生的事（常用于宾语从句中）：He said he would come. / I thought it was going to rain.',
									],
								},
							],
						},
						{
							id: 's3.5',
							title: '3.5 现在进行时 (Present Continuous)',
							points: [
								{
									name: '构成',
									rules: [
										'am/is/are + 现在分词',
										'否定：am/is/are + not + 现在分词',
									],
								},
								{
									name: '用法',
									rules: [
										'表示说话时正在进行的动作：She is reading a book now.',
										'表示现阶段正在进行而说话时不一定在做的动作：I am learning English this semester.',
										'表示按计划即将发生的动作（限于 go, come, leave, arrive 等趋向动词）：They are leaving tomorrow.',
										'与 always, constantly 连用表示反复或不满：He is always losing his keys!',
									],
								},
								{
									name: '不能用于进行时的动词',
									rules: [
										'表示感觉的动词：see, hear, smell, taste, feel',
										'表示情感的动词：love, hate, like, want, wish',
										'表示拥有的动词：have, own, belong, possess',
										'表示思想的动词：know, believe, understand, remember, forget',
										'其他：seem, appear, cost, weigh, contain',
									],
								},
							],
						},
						{
							id: 's3.6',
							title: '3.6 过去进行时 (Past Continuous)',
							points: [
								{
									name: '构成',
									rules: ['was/were + 现在分词'],
								},
								{
									name: '用法',
									rules: [
										'表示过去某一时刻正在进行的动作：I was sleeping at 10 last night.',
										'表示过去某一时期正在进行的动作：They were working in the factory that year.',
										'when/while 引导的时间状语从句中：I was reading when he came in. / While I was reading, he came in.',
									],
								},
								{
									name: '过去进行时与一般过去时的区别',
									rules: [
										'过去进行时强调动作正在进行',
										'一般过去时表示动作已完成：I was reading a novel last night. (强调过程) / I read a novel last night. (强调完成)',
									],
								},
							],
						},
						{
							id: 's3.7',
							title: '3.7 现在完成时 (Present Perfect)',
							points: [
								{
									name: '构成',
									rules: [
										'have/has + 过去分词',
										'否定：have/has + not + 过去分词',
									],
								},
								{
									name: '用法',
									rules: [
										'表示过去发生的动作对现在造成的影响：I have lost my key. (现在没有钥匙)',
										'表示从过去到现在的经历：I have been to Beijing twice.',
										'表示从过去开始持续到现在的动作或状态：I have lived here since 2020.',
										'表示刚刚完成：I have just finished my homework.',
									],
								},
								{
									name: '时间标志词',
									rules: [
										'since + 过去时间点：since 2020, since yesterday',
										'for + 时间段：for two years, for a long time',
										'already, yet, just, ever, never, recently, lately',
										'so far, up to now, in the past few years',
										'this morning/week/month (说话时这些时段尚未结束)',
									],
								},
								{
									name: 'have been to 与 have gone to',
									rules: [
										'have been to + 地点：去过（已回来）：He has been to Paris.',
										'have gone to + 地点：去了（未回来）：He has gone to Paris. (他在巴黎)',
									],
								},
								{
									name: '现在完成时与一般过去时的区别',
									rules: [
										'现在完成时强调对现在的影响，不能与具体过去时间连用',
										'一般过去时只说明过去的事实，可与具体过去时间连用：I have seen that film. / I saw that film last week.',
									],
								},
							],
						},
						{
							id: 's3.8',
							title: '3.8 过去完成时 (Past Perfect)',
							points: [
								{
									name: '构成',
									rules: ['had + 过去分词'],
								},
								{
									name: '用法',
									rules: [
										'表示过去某一时间或动作之前已经完成的动作（"过去的过去"）：When I arrived, the train had left.',
										'表示从过去某一时间开始持续到过去另一时间的动作：He had lived there for 10 years before he moved.',
										'用于 hope, expect, intend, plan 等词后表示未实现的愿望：I had hoped to pass the exam.',
									],
								},
							],
						},
						{
							id: 's3.9',
							title: '3.9 现在完成进行时 (Present Perfect Continuous)',
							points: [
								{
									name: '构成',
									rules: ['have/has been + 现在分词'],
								},
								{
									name: '用法',
									rules: [
										'表示从过去某时开始一直持续到现在的动作（可能仍在进行）：I have been waiting for you for two hours.',
										'强调动作的持续性：She has been teaching for 20 years.',
									],
								},
								{
									name: '与现在完成时的区别',
									rules: [
										'现在完成进行时强调动作的持续过程',
										'现在完成时强调动作的结果：I have been reading the book. (还在读) / I have read the book. (已读完)',
									],
								},
							],
						},
						{
							id: 's3.10',
							title: '3.10 过去完成进行时 (Past Perfect Continuous)',
							points: [
								{
									name: '构成',
									rules: ['had been + 现在分词'],
								},
								{
									name: '用法',
									rules: [
										'表示过去某一时间之前一直持续的动作：He had been working for 10 hours before he took a rest.',
									],
								},
							],
						},
						{
							id: 's3.11',
							title: '3.11 将来进行时 (Future Continuous)',
							points: [
								{
									name: '构成',
									rules: ['will be + 现在分词'],
								},
								{
									name: '用法',
									rules: [
										'表示将来某一时刻正在进行的动作：At 8 tomorrow, I will be having breakfast.',
										'表示按计划将来要做的动作：I will be seeing him tomorrow.',
									],
								},
							],
						},
						{
							id: 's3.12',
							title: '3.12 将来完成时 (Future Perfect)',
							points: [
								{
									name: '构成',
									rules: ['will have + 过去分词'],
								},
								{
									name: '用法',
									rules: [
										'表示到将来某一时间为止已完成的动作：By next Monday, I will have finished the report.',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch4',
					title: '第四章：被动语态 (Passive Voice)',
					sections: [
						{
							id: 's4.1',
							title: '4.1 被动语态的构成',
							points: [
								{
									name: '基本结构',
									rules: [
										'be + 过去分词',
										'不同时态的被动语态通过改变 be 的形式来实现',
									],
								},
								{
									name: '各时态被动语态',
									table: {
										headers: ['时态', '被动语态结构', '例句'],
										rows: [
											[
												'一般现在时',
												'am/is/are + done',
												'English is spoken worldwide.',
											],
											[
												'一般过去时',
												'was/were + done',
												'The window was broken yesterday.',
											],
											[
												'一般将来时',
												'will be done',
												'The work will be finished soon.',
											],
											[
												'现在进行时',
												'am/is/are being done',
												'The house is being painted.',
											],
											[
												'过去进行时',
												'was/were being done',
												'The road was being repaired.',
											],
											[
												'现在完成时',
												'have/has been done',
												'The book has been translated.',
											],
											[
												'过去完成时',
												'had been done',
												'The work had been done before I came.',
											],
											[
												'含情态动词',
												'can/must/should be done',
												'The work must be done carefully.',
											],
										],
									},
								},
							],
						},
						{
							id: 's4.2',
							title: '4.2 被动语态的用法',
							points: [
								{
									name: '使用被动语态的场合',
									rules: [
										'不知道或没必要说明动作的执行者：The window was broken.',
										'强调动作的承受者：The book was written by Lu Xun.',
										'更客观、正式的表达：It is believed that...',
										'在公告、通知、新闻中常用被动语态',
									],
								},
								{
									name: '不能用于被动语态的动词',
									rules: [
										'不及物动词：happen, occur, take place, break out, disappear',
										'某些及物动词与名词构成不可分割的短语：have a rest, lose heart, keep words',
									],
								},
								{
									name: '特殊被动结构',
									rules: [
										'It is said/believed/reported/known that...：据说/人们相信/据报道/众所周知...',
										'Sb. is said/believed/reported to do...：某人据说/被认为/据报道...',
										'get + 过去分词（口语中）：The cup got broken.',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch5',
					title: '第五章：非谓语动词 (Non-finite Verbs)',
					content:
						'非谓语动词包括不定式、动名词和分词，不能单独作谓语，但可以担任主语、宾语、表语、定语、状语等。',
					sections: [
						{
							id: 's5.1',
							title: '5.1 动词不定式 (Infinitive)',
							points: [
								{
									name: '构成',
									rules: [
										'to + 动词原形',
										'否定形式：not to do',
										'不定式有进行式 (to be doing)、完成式 (to have done)、被动式 (to be done)',
									],
								},
								{
									name: '作主语',
									rules: [
										'To learn English well is important.',
										'常用 it 作形式主语：It is important to learn English well.',
										'It is + adj. + (for/of sb.) + to do：It is kind of you to help me.',
									],
								},
								{
									name: '作宾语',
									rules: [
										'常接不定式作宾语的动词：want, hope, wish, expect, decide, plan, agree, refuse, manage, offer, pretend, promise, fail, choose, learn',
										"疑问词 + to do：I don't know what to do.",
										'接不定式和动名词意义不同的动词：remember to do (记得要做) / remember doing (记得做过)',
									],
								},
								{
									name: '作宾语补足语',
									rules: [
										'ask/tell/want/expect sb. to do sth.',
										'感官动词 see/hear/watch/notice + sb. do (省略 to) / doing / done',
										'使役动词 make/let/have + sb. do (省略 to)',
									],
								},
								{
									name: '作定语',
									rules: [
										'放在名词后：I have something to tell you.',
										'不定式与被修饰的名词有动宾关系：I need a pen to write with.',
										'不定式用主动形式表示被动意义：I have a lot of work to do.',
									],
								},
								{
									name: '作状语',
									rules: [
										'目的状语：I came here to see you. / In order to pass, he studied hard.',
										'结果状语：He lived to be 90. / He hurried to the station, only to find the train had left.',
										"原因状语：I'm glad to see you.",
									],
								},
								{
									name: '作表语',
									rules: [
										'My dream is to become a doctor.',
										'To see is to believe.',
									],
								},
							],
						},
						{
							id: 's5.2',
							title: '5.2 动名词 (Gerund)',
							points: [
								{
									name: '构成',
									rules: [
										'动词 + -ing',
										'否定形式：not doing',
										'有完成式 (having done) 和被动式 (being done / having been done)',
									],
								},
								{
									name: '作主语',
									rules: [
										'Swimming is good exercise.',
										'Collecting stamps is his hobby.',
										'It is no use/good doing sth.：It is no use crying over spilt milk.',
									],
								},
								{
									name: '作宾语',
									rules: [
										"只接动名词的动词：enjoy, finish, avoid, mind, practice, suggest, consider, imagine, deny, keep, give up, can't help, feel like, look forward to, be worth",
										'接动名词和不定式均可但意义不同的动词：',
										'stop doing (停止做) / stop to do (停下来去做)',
										'remember doing (记得做过) / remember to do (记得要做)',
										'forget doing (忘记做过) / forget to do (忘记要做)',
										'try doing (尝试做) / try to do (努力做)',
										'go on doing (继续做同一件事) / go on to do (接着做另一件事)',
										'mean doing (意味着) / mean to do (打算做)',
										'regret doing (后悔做过) / regret to do (遗憾要做)',
									],
								},
								{
									name: '作表语',
									rules: ['His hobby is reading.', 'Seeing is believing.'],
								},
								{
									name: '作定语',
									rules: [
										'a swimming pool (游泳池)',
										'a reading room (阅览室)',
										'a sleeping bag (睡袋)',
									],
								},
								{
									name: '动名词的复合结构',
									rules: [
										'物主代词/名词所有格 + doing：Do you mind my opening the window?',
										'口语中可用宾格：Do you mind me opening the window?',
									],
								},
							],
						},
						{
							id: 's5.3',
							title: '5.3 分词 (Participles)',
							points: [
								{
									name: '现在分词 (Present Participle)',
									rules: [
										'构成：动词 + -ing',
										'表示主动、进行：a sleeping dog (正在睡觉的狗)',
										'作定语：The girl standing there is my sister.',
										'作状语：Walking in the park, I met an old friend. (时间)',
										'作宾语补足语：I saw him crossing the street.',
										'作表语：The news is exciting.',
									],
								},
								{
									name: '过去分词 (Past Participle)',
									rules: [
										'规则动词加 -ed，不规则动词有特殊形式',
										'表示被动、完成：a broken window (被打破的窗户)',
										'作定语：The book written by him is popular.',
										'作状语：Seen from the hill, the city looks beautiful.',
										'作宾语补足语：I had my hair cut.',
										'作表语：I am interested in English.',
									],
								},
								{
									name: '现在分词与过去分词的区别',
									table: {
										headers: ['', '现在分词 (-ing)', '过去分词 (-ed)'],
										rows: [
											['语态', '主动', '被动'],
											['时间', '进行', '完成'],
											[
												'例词',
												'interesting (令人感兴趣的)',
												'interested (感兴趣的)',
											],
											['例词', 'exciting (令人兴奋的)', 'excited (感到兴奋的)'],
											[
												'例词',
												'surprising (令人惊讶的)',
												'surprised (感到惊讶的)',
											],
											['例词', 'boring (令人无聊的)', 'bored (感到无聊的)'],
											[
												'例词',
												'disappointing (令人失望的)',
												'disappointed (感到失望的)',
											],
											[
												'例词',
												'confusing (令人困惑的)',
												'confused (感到困惑的)',
											],
										],
									},
								},
								{
									name: '独立主格结构 (Absolute Phrase)',
									rules: [
										'名词/代词 + 分词（逻辑主语与句子主语不同）',
										'Weather permitting, we will go out for a picnic.',
										'The teacher coming in, the students stopped talking.',
										'There being no bus, we had to walk home.',
									],
								},
								{
									name: 'with 复合结构',
									rules: [
										'with + 宾语 + 宾语补足语（分词/形容词/副词/介词短语/不定式）',
										'With the door open, he left the room.',
										'With the work finished, he went home.',
										"With so much work to do, I can't go out.",
									],
								},
							],
						},
					],
				},
				{
					id: 'ch6',
					title: '第六章：虚拟语气 (Subjunctive Mood)',
					content: '虚拟语气表示说话人的愿望、假设、建议或猜测，而非客观事实。',
					sections: [
						{
							id: 's6.1',
							title: '6.1 if 条件句中的虚拟语气',
							points: [
								{
									name: '三种类型',
									table: {
										headers: ['类型', 'if 从句', '主句', '例句'],
										rows: [
											[
												'与现在事实相反',
												'过去式 (be → were)',
												'would/could/should/might + 动词原形',
												'If I were you, I would study harder.',
											],
											[
												'与过去事实相反',
												'had + 过去分词',
												'would/could/should/might + have + 过去分词',
												'If I had known, I would have helped you.',
											],
											[
												'与将来事实相反',
												'过去式 / were to + 动词原形 / should + 动词原形',
												'would/could/should/might + 动词原形',
												'If it rained tomorrow, I would stay home.',
											],
										],
									},
								},
								{
									name: 'if 的省略与倒装',
									rules: [
										'如果 if 从句中含有 were, had 或 should，可省略 if，将 were/had/should 提前构成倒装',
										'Were I you, I would study harder. (= If I were you...)',
										'Had I known, I would have helped you. (= If I had known...)',
										'Should it rain, the match would be cancelled. (= If it should rain...)',
									],
								},
								{
									name: '错综时间条件句',
									description: '条件从句和主句的时间不一致',
									rules: [
										'If I had worked harder at school (过去), I would have a better job now (现在).',
										"If he were more careful (现在), he wouldn't have made that mistake yesterday (过去).",
									],
								},
							],
						},
						{
							id: 's6.2',
							title: '6.2 名词性从句中的虚拟语气',
							points: [
								{
									name: 'wish 后的宾语从句',
									rules: [
										'wish + 过去式：表示对现在的愿望（与现在事实相反）',
										'I wish I knew the answer. (其实我不知道)',
										'wish + 过去完成式：表示对过去的愿望（与过去事实相反）',
										'I wish I had studied harder. (其实我没有)',
										'wish + would + 动词原形：表示对将来的愿望或请求',
										'I wish you would stop talking.',
									],
								},
								{
									name: 'suggest/demand/insist 等动词后的从句',
									rules: [
										'表示建议、命令、要求、坚持等动词后的宾语从句用 (should) + 动词原形',
										'常见动词：suggest, recommend, advise, propose, demand, require, request, insist, order, command',
										'I suggest that he (should) go there at once.',
										'The doctor insisted that the patient (should) stay in bed.',
										'注意：insist 表示"坚持说"时不用虚拟：He insisted that he was innocent.',
									],
								},
								{
									name: 'suggestion/idea/order 等名词后的从句',
									rules: [
										'与上述动词同源的名词后的表语从句和同位语从句也用 (should) + 动词原形',
										'My suggestion is that he (should) go there at once.',
										'The order that the work (should) be finished on time was given.',
									],
								},
								{
									name: 'It is + adj. + that 从句',
									rules: [
										'important, necessary, essential, vital, urgent, natural, strange 等形容词后的主语从句用 (should) + 动词原形',
										'It is important that everyone (should) understand the rules.',
										'It is necessary that the problem (should) be solved immediately.',
									],
								},
								{
									name: 'as if / as though 引导的方式状语从句',
									rules: [
										'表示与现在事实相反：用过去式 (be → were)',
										'He talks as if he knew everything.',
										'表示与过去事实相反：用过去完成式',
										'He looked as if he had seen a ghost.',
									],
								},
								{
									name: 'would rather 的虚拟用法',
									rules: [
										'would rather + 动词原形：宁愿现在做某事',
										'I would rather stay at home.',
										'would rather + 过去式：宁愿现在或将来做某事',
										'I would rather you came tomorrow.',
										'would rather + 过去完成式：宁愿过去做了某事',
										"I would rather you hadn't told her.",
									],
								},
							],
						},
					],
				},
				{
					id: 'ch7',
					title: '第七章：从句 (Clauses)',
					content:
						'从句是具有主谓结构但不能独立成句的语法单位，在复合句中充当某个句子成分。',
					sections: [
						{
							id: 's7.1',
							title: '7.1 名词性从句 (Noun Clauses)',
							points: [
								{
									name: '主语从句',
									rules: [
										'That 引导：That he passed the exam surprised everyone.',
										'Whether 引导（不用 if）：Whether he will come is still uncertain.',
										'疑问词引导：What he said is true. / How he did it remains a mystery.',
										'it 作形式主语：It is important that we should learn English. / It is a pity that you missed the party.',
									],
								},
								{
									name: '宾语从句',
									rules: [
										'that 引导（that 可省略）：I think (that) he is right.',
										"whether/if 引导：I don't know whether/if he will come.",
										'疑问词引导：Can you tell me where the station is?',
										'宾语从句的时态呼应：主句为过去时，从句用相应过去时态',
										'I thought he was a student. (从句用过去式)',
										'He said he had finished the work. (从句用过去完成式)',
									],
								},
								{
									name: '表语从句',
									rules: [
										"The problem is that we don't have enough time.",
										'The question is whether we should go or stay.',
										'This is where he was born.',
										'That is what I want to say.',
									],
								},
								{
									name: '同位语从句',
									rules: [
										'跟在 fact, news, idea, hope, belief, doubt, evidence, suggestion, order 等名词后',
										'The news that he won the prize is exciting.',
										'I have no idea where he has gone.',
										'The suggestion that we should leave early was accepted.',
										'同位语从句与定语从句的区别：同位语从句解释名词内容（that 不作成分），定语从句修饰名词（that 作主语/宾语）',
									],
								},
							],
						},
						{
							id: 's7.2',
							title: '7.2 定语从句 (Attributive Clauses)',
							points: [
								{
									name: '限制性定语从句',
									rules: [
										'修饰先行词，是句子不可缺少的部分，不用逗号隔开',
										'The man who is standing there is my teacher.',
										'The book that I bought yesterday is very interesting.',
									],
								},
								{
									name: '非限制性定语从句',
									rules: [
										'对先行词作补充说明，用逗号隔开，去掉后不影响主句意思',
										'Beijing, which is the capital of China, is a beautiful city.',
										'My father, who is 50, still plays basketball.',
										'不能用 that 引导非限制性定语从句',
									],
								},
								{
									name: '关系代词的选择',
									rules: [
										'先行词为人：who/whom/that/whose',
										'先行词为物：which/that/whose',
										'先行词为人和物：that',
										'先行词被 the only, the very, the first, the last 修饰时用 that',
										'先行词是不定代词 (all, everything, nothing, anything 等) 时用 that',
										'先行词被序数词或最高级修饰时用 that',
										'介词后只能用 which/whom：The house in which he lives is old.',
										'非限制性定语从句中指人用 who/whom，指物用 which',
									],
								},
								{
									name: '关系副词',
									rules: [
										'when = at/in/on which (时间)：I remember the day when we first met.',
										'where = at/in/on which (地点)：This is the school where I studied.',
										'why = for which (原因)：That is the reason why he was late.',
										"the way + in which / that / 省略：I don't like the way (that) he speaks.",
									],
								},
								{
									name: 'as 引导的定语从句',
									rules: [
										'the same...as：与...相同的',
										'such...as：像...这样的',
										'as 引导非限制性定语从句（可放在句首）：As is known to all, the earth is round.',
									],
								},
							],
						},
						{
							id: 's7.3',
							title: '7.3 状语从句 (Adverbial Clauses)',
							points: [
								{
									name: '时间状语从句',
									rules: [
										'when, while, as, before, after, since, until/till, as soon as, once, the moment, immediately',
										'hardly...when... / no sooner...than...：一...就...（主句用过去完成时，从句用一般过去时）',
										'Hardly had I arrived when it began to rain.',
										'No sooner had he finished his homework than he went out to play.',
									],
								},
								{
									name: '地点状语从句',
									rules: [
										'where, wherever：Where there is a will, there is a way.',
									],
								},
								{
									name: '原因状语从句',
									rules: [
										'because, since, as, now that',
										'because 语气最强，回答 why 的提问',
										'since/as 表示已知原因',
										"now that = since：Now that you are here, let's begin.",
									],
								},
								{
									name: '条件状语从句',
									rules: [
										'if, unless (= if not), as long as, once, provided that, on condition that',
										'if 引导的条件句分为真实条件句和虚拟条件句',
										"unless 不能与 if not 完全互换：I won't go unless you go. (= I won't go if you don't go.)",
									],
								},
								{
									name: '让步状语从句',
									rules: [
										'although/though：虽然（不能与 but 同用，但可与 yet/still 连用）',
										'even though/if：即使',
										'whatever/whoever/whenever/wherever/however = no matter what/who/when/where/how',
										'whether...or...：无论...还是...',
										'as 引导的让步从句（倒装）：Child as he is, he knows a lot.',
									],
								},
								{
									name: '目的状语从句',
									rules: [
										'so that, in order that：以便',
										'从句中常含有情态动词 can/could/may/might/will/would',
										'Speak louder so that everyone can hear you.',
									],
								},
								{
									name: '结果状语从句',
									rules: [
										'so + adj./adv. + that：如此...以至于...',
										'such + (a/an) + adj. + n. + that：如此...以至于...',
										'so...that... 与 such...that... 的区别：so 修饰形容词/副词，such 修饰名词',
										"so that 也可表示结果（不加情态动词）：He was ill, so that he didn't go to school.",
									],
								},
								{
									name: '方式状语从句',
									rules: [
										'as, as if, as though',
										'Do as I told you.',
										'He talks as if he knew everything.',
									],
								},
								{
									name: '比较状语从句',
									rules: [
										'than：比',
										'as...as：和...一样',
										'not so/as...as：不如...',
										'the + 比较级, the + 比较级：越...越...',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch8',
					title: '第八章：特殊句式 (Special Sentence Patterns)',
					sections: [
						{
							id: 's8.1',
							title: '8.1 There be 句型',
							points: [
								{
									name: '基本结构',
									rules: [
										'There be + 名词 + 地点/时间状语',
										'be 的单复数由后面的名词决定：There is a book on the desk. / There are some books on the desk.',
										'There be 不能与 have 同时使用',
									],
								},
								{
									name: '各种时态',
									rules: [
										'There is/are (现在)',
										'There was/were (过去)',
										'There will be (将来)',
										'There have been (现在完成)',
										'There has been a lot of rain recently.',
									],
								},
								{
									name: '其他形式',
									rules: [
										'There seem/appear to be：似乎有',
										'There is likely to be：可能有',
										'There used to be：过去常有',
										'There is sure to be：一定有',
									],
								},
								{
									name: '反意疑问句',
									rules: [
										"There is a book, isn't there?",
										"There aren't any students, are there?",
									],
								},
							],
						},
						{
							id: 's8.2',
							title: '8.2 倒装句 (Inversion)',
							points: [
								{
									name: '完全倒装',
									rules: [
										'表方位的副词 (here, there, up, down, in, out, away) 放在句首时：Here comes the bus. / Away went the boy.',
										'注意：主语为代词时不倒装：Here it comes. / Away he went.',
										'表示地点的介词短语放在句首时：On the wall hangs a picture.',
										'直接引语全部或部分放在句首时："What do you want?" asked the teacher.',
									],
								},
								{
									name: '部分倒装',
									rules: [
										'否定词或含否定意义的词放在句首时：Never have I seen such a beautiful place. / Not only did he come, but he also brought gifts.',
										'Only + 状语放在句首时：Only then did I realize my mistake. / Only in this way can you solve the problem.',
										'So...that... 中 so 放在句首时：So tired was he that he fell asleep immediately.',
										'So/Neither/Nor + 助动词/情态动词 + 主语（表示"也/也不"）：He can swim. So can I. / I don\'t like it. Neither do I.',
										'as 引导的让步状语从句（表语/状语/动词原形提前）：Hard as he tried, he failed.',
									],
								},
							],
						},
						{
							id: 's8.3',
							title: '8.3 强调句 (Emphatic Sentences)',
							points: [
								{
									name: 'It is/was...that/who... 强调句型',
									rules: [
										'强调主语：It was Tom who broke the window.',
										'强调宾语：It was the window that Tom broke.',
										'强调状语：It was in the park that I met him.',
										'强调时间状语：It was yesterday that I saw her.',
										'判断方法：去掉 It is/was...that/who 后句子仍然完整',
										'not until 的强调：It was not until midnight that he came back.',
										'疑问句的强调：Was it in 2020 that you graduated?',
									],
								},
								{
									name: 'do/does/did + 动词原形（强调谓语）',
									rules: [
										'I do love you. (我确实爱你)',
										'He did come yesterday. (他昨天确实来了)',
										'Do be careful! (一定要小心)',
									],
								},
							],
						},
						{
							id: 's8.4',
							title: '8.4 省略句 (Elliptical Sentences)',
							points: [
								{
									name: '常见省略情况',
									rules: [
										'回答中的省略：— Have you finished? — Yes, I have (finished).',
										'并列句中的省略：He likes reading and she likes (reading) too.',
										'状语从句中的省略：When (you are) in trouble, ask for help. / If (it is) possible, come early.',
										"不定式的省略（保留 to）：— Would you like to come? — I'd love to (come).",
										'独立主格中的省略：The meeting (being) over, everyone went home.',
									],
								},
							],
						},
						{
							id: 's8.5',
							title: '8.5 反意疑问句 (Tag Questions)',
							points: [
								{
									name: '基本规则',
									rules: [
										"前肯后否，前否后肯：You are a student, aren't you? / He can't swim, can he?",
										'be 动词、助动词、情态动词与主句一致',
										"注意：I am → aren't I? / Let's → shall we? / Let us → will you?",
										"祈使句：Open the door, will you? / Don't be late, will you?",
										'含有否定词 (never, hardly, seldom, few, little, no) 视为否定句',
										'He has few friends, does he? / She seldom goes out, does she?',
										"反意疑问句的回答根据事实而非形式：— He isn't a teacher, is he? — Yes, he is. (不，他是老师。)",
									],
								},
							],
						},
						{
							id: 's8.6',
							title: '8.6 直接引语与间接引语 (Direct and Indirect Speech)',
							points: [
								{
									name: '人称变化',
									rules: [
										'一随主（引语中的第一人称随主句主语变化）：He said, "I am busy." → He said that he was busy.',
										'二随宾（引语中的第二人称随主句宾语变化）：She said to me, "You are right." → She told me that I was right.',
										'第三人称不变：He said, "She is beautiful." → He said that she was beautiful.',
									],
								},
								{
									name: '时态变化（主句为过去时）',
									table: {
										headers: ['直接引语时态', '间接引语时态'],
										rows: [
											['一般现在时', '一般过去时'],
											['一般过去时', '过去完成时'],
											['现在完成时', '过去完成时'],
											['现在进行时', '过去进行时'],
											['一般将来时', '过去将来时'],
											['现在完成进行时', '过去完成进行时'],
											['过去完成时', '过去完成时（不变）'],
											['一般过去时（客观真理）', '一般过去时（不变）'],
										],
									},
								},
								{
									name: '时间/地点状语变化',
									table: {
										headers: ['直接引语', '间接引语'],
										rows: [
											['now', 'then'],
											['today', 'that day'],
											['yesterday', 'the day before / the previous day'],
											['tomorrow', 'the next day / the following day'],
											['this', 'that'],
											['these', 'those'],
											['here', 'there'],
											['last week', 'the week before'],
											['next month', 'the next month'],
											['ago', 'before'],
										],
									},
								},
							],
						},
						{
							id: 's8.7',
							title: '8.7 主谓一致 (Subject-Verb Agreement)',
							points: [
								{
									name: '语法一致原则',
									rules: [
										'单数主语 + 单数谓语，复数主语 + 复数谓语',
										'He is a student. / They are students.',
										'不可数名词作主语时谓语用单数：Water is important.',
										'动名词/不定式/从句作主语时谓语用单数：Reading is fun. / To see is to believe.',
									],
								},
								{
									name: '意义一致原则',
									rules: [
										'集合名词作主语：强调整体用单数，强调成员用复数',
										'My family is large. / My family are all music lovers.',
										'表示数量概念的名词：a number of + 复数名词（谓语用复数），the number of + 复数名词（谓语用单数）',
										'A number of students are waiting. / The number of students is 50.',
										'表示时间、金钱、距离等的复数名词作主语时谓语用单数：Ten dollars is enough.',
										'each/every/no/many a + 单数名词 → 谓语用单数',
									],
								},
								{
									name: '就近原则',
									rules: [
										'either...or..., neither...nor..., not only...but also... 连接并列主语时，谓语与最近的主语一致',
										'Neither you nor I am wrong.',
										'Not only he but also his parents are coming.',
										'there be 句型中谓语与最近的名词一致：There is a pen and two books on the desk.',
									],
								},
							],
						},
						{
							id: 's8.8',
							title: '8.8 it 的用法',
							points: [
								{
									name: 'it 作代词',
									rules: [
										'指代上文提到的事物：I bought a book. It is interesting.',
										"指代时间：It is Monday. / It is 8 o'clock.",
										'指代天气：It is raining. / It is cold.',
										'指代距离：It is far from here.',
										"指代不明身份的人：— Who is it? — It's me.",
									],
								},
								{
									name: 'it 作形式主语',
									rules: [
										'It + be + adj. + (for/of sb.) + to do：It is important to learn English.',
										'It + be + adj. + doing：It is no use crying over spilt milk.',
										'It + be + adj. + that 从句：It is true that health is wealth.',
										'It + be + noun + doing/to do/that 从句',
										'It takes sb. + 时间 + to do：It takes me 30 minutes to get to school.',
									],
								},
								{
									name: 'it 作形式宾语',
									rules: [
										'find/think/consider/make + it + adj. + to do/that 从句',
										'I find it difficult to learn English.',
										'She thought it necessary that he should go.',
									],
								},
								{
									name: 'it 用于强调句',
									rules: [
										'It is/was + 被强调部分 + that/who + 其余部分',
										'It was in the park that I met him.',
									],
								},
							],
						},
					],
				},
				{
					id: 'ch9',
					title: '第九章：标点符号与书写规范 (Punctuation)',
					sections: [
						{
							id: 's9.1',
							title: '9.1 常用标点符号',
							points: [
								{
									name: '句号 (Period/Full Stop .)',
									rules: [
										'用于陈述句和祈使句末尾',
										'用于缩写：Mr., Dr., U.S.A.',
									],
								},
								{
									name: '问号 (Question Mark ?)',
									rules: ['用于疑问句末尾', '用于反意疑问句末尾'],
								},
								{
									name: '感叹号 (Exclamation Mark !)',
									rules: ['用于感叹句末尾', '用于表示强烈情感的句子末尾'],
								},
								{
									name: '逗号 (Comma ,)',
									rules: [
										'分隔并列成分：apples, oranges, and bananas',
										'引导状语从句后：If it rains, I will stay home.',
										'分隔非限制性定语从句：Beijing, which is the capital, is beautiful.',
										"分隔插入语：He, however, didn't agree.",
										'直接引语前：She said, "I\'m tired."',
									],
								},
								{
									name: '冒号 (Colon :)',
									rules: [
										'引出列表：I need three things: a pen, a book, and a ruler.',
										'引出解释说明',
										'直接引语前（较正式）',
									],
								},
								{
									name: '分号 (Semicolon ;)',
									rules: [
										'连接两个独立分句（关系密切）：It was raining; we decided to stay home.',
										'分隔含有逗号的并列项',
									],
								},
								{
									name: '引号 (Quotation Marks "" \'\')',
									rules: [
										'引用直接引语',
										'引用文章/书名（短篇）',
										'强调或特殊含义的词',
									],
								},
								{
									name: "撇号 (Apostrophe ')",
									rules: [
										"名词所有格：Tom's book",
										"缩写：don't, can't, it's",
										"注意区分 its (它的) 和 it's (it is)",
									],
								},
								{
									name: '连字符 (Hyphen -)',
									rules: [
										'复合词：twenty-one, mother-in-law',
										'前缀与词根之间：anti-war, non-stop',
										'行末单词断开',
									],
								},
							],
						},
					],
				},
			],
		},
	],
} as GrammarReference;
