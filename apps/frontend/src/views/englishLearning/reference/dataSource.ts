/**
 * 英语学习参考静态数据
 */
import type { GrammarReference, MorphologyReference } from './types';

export const dataSource = {
	grammar: {
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
												description:
													'不可数名词不能直接用数字计数，需要借助量词',
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
												examples: [
													'Knowledge is power.',
													'The cat is sleeping.',
												],
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
												description:
													'who 作主语，whom 作宾语，whose 表示"谁的"',
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
														[
															'以 e 结尾加 -r/-st',
															'large',
															'larger',
															'largest',
														],
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
								content:
									'连词连接词、短语、从句或句子，表示它们之间的逻辑关系。',
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
												description:
													'连接主语和表语，说明主语的身份、特征或状态',
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
														examples: [
															'look',
															'sound',
															'smell',
															'taste',
															'feel',
														],
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
														[
															'should/ought to',
															'应该',
															'You should study hard.',
														],
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
												[
													'例词',
													'exciting (令人兴奋的)',
													'excited (感到兴奋的)',
												],
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
						content:
							'虚拟语气表示说话人的愿望、假设、建议或猜测，而非客观事实。',
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
	},
	morphology: {
		prefixes: {
			title: '前缀 (Prefixes)',
			description: '前缀是置于词根前面的词缀，可以改变单词的意思',
			categories: [
				{
					name: '否定/相反前缀',
					items: [
						{
							prefix: 'un-',
							meaning: '不，非，相反',
							examples: [
								{
									word: 'unhappy',
									ipa: '/ʌnˈhæpi/',
									pos: 'adj.',
									translationZh: '不开心的',
								},
								{
									word: 'unable',
									ipa: '/ʌnˈeɪbəl/',
									pos: 'adj.',
									translationZh: '不能的',
								},
								{
									word: 'undo',
									ipa: '/ʌnˈduː/',
									pos: 'n.',
									translationZh: '撤销',
								},
							],
						},
						{
							prefix: 'in-',
							meaning: '不，非，向内',
							examples: [
								{
									word: 'incorrect',
									ipa: '/ˌɪnkəˈrekt/',
									pos: 'n.',
									translationZh: '不正确的',
								},
								{
									word: 'incomplete',
									ipa: '/ˌɪnkəmˈpliːt/',
									pos: 'n.',
									translationZh: '不完整的',
								},
								{
									word: 'intake',
									ipa: '/ˈɪnteɪk/',
									pos: 'n.',
									translationZh: '摄入',
								},
							],
						},
						{
							prefix: 'im-',
							meaning: '不，非（用于b,m,p前）',
							examples: [
								{
									word: 'impossible',
									ipa: '/ɪmˈpɒsəbəl/',
									pos: 'adj.',
									translationZh: '不可能的',
								},
								{
									word: 'impolite',
									ipa: '/ˌɪmpəˈlaɪt/',
									pos: 'n.',
									translationZh: '不礼貌的',
								},
								{
									word: 'imbalance',
									ipa: '/ɪmˈbæləns/',
									pos: 'n.',
									translationZh: '不平衡',
								},
							],
						},
						{
							prefix: 'il-',
							meaning: '不，非（用于l前）',
							examples: [
								{
									word: 'illegal',
									ipa: '/ɪˈliːɡəl/',
									pos: 'n.',
									translationZh: '非法的',
								},
								{
									word: 'illogical',
									ipa: '/ɪˈlɒdʒɪkəl/',
									pos: 'adj.',
									translationZh: '不合逻辑的',
								},
								{
									word: 'illiterate',
									ipa: '/ɪˈlɪtərət/',
									pos: 'adj.',
									translationZh: '文盲的',
								},
							],
						},
						{
							prefix: 'ir-',
							meaning: '不，非（用于r前）',
							examples: [
								{
									word: 'irregular',
									ipa: '/ɪˈreɡjələ/',
									pos: 'n.',
									translationZh: '不规则的',
								},
								{
									word: 'irresponsible',
									ipa: '/ˌɪrɪˈspɒnsəbəl/',
									pos: 'adj.',
									translationZh: '不负责任的',
								},
								{
									word: 'irrelevant',
									ipa: '/ɪˈreləvənt/',
									pos: 'n./adj.',
									translationZh: '不相关的',
								},
							],
						},
						{
							prefix: 'dis-',
							meaning: '不，相反，分离',
							examples: [
								{
									word: 'disagree',
									ipa: '/ˌdɪsəˈɡriː/',
									pos: 'n.',
									translationZh: '不同意',
								},
								{
									word: 'disappear',
									ipa: '/ˌdɪsəˈpɪə/',
									pos: 'n.',
									translationZh: '消失',
								},
								{
									word: 'disconnect',
									ipa: '/ˌdɪskəˈnekt/',
									pos: 'n.',
									translationZh: '断开',
								},
							],
						},
						{
							prefix: 'non-',
							meaning: '非，不',
							examples: [
								{
									word: 'nonstop',
									ipa: '/ˈnɒnstɒp/',
									pos: 'n.',
									translationZh: '不停的',
								},
								{
									word: 'nonsense',
									ipa: '/ˈnɒnsəns/',
									pos: 'n.',
									translationZh: 'nonsense',
								},
								{
									word: 'nonviolent',
									ipa: '/nɒnˈvaɪələnt/',
									pos: 'n./adj.',
									translationZh: '非暴力的',
								},
							],
						},
						{
							prefix: 'mis-',
							meaning: '错误，坏',
							examples: [
								{
									word: 'mistake',
									ipa: '/mɪˈsteɪk/',
									pos: 'n.',
									translationZh: '错误',
								},
								{
									word: 'misunderstand',
									ipa: '/ˌmɪsʌndəˈstænd/',
									pos: 'n.',
									translationZh: '误解',
								},
								{
									word: 'mislead',
									ipa: '/mɪsˈliːd/',
									pos: 'n.',
									translationZh: '误导',
								},
							],
						},
						{
							prefix: 'anti-',
							meaning: '反对，抗',
							examples: [
								{
									word: 'antibiotic',
									ipa: '/ˌæntibaɪˈɒtɪk/',
									pos: 'adj.',
									translationZh: '抗生素',
								},
								{
									word: 'antisocial',
									ipa: '/ˌæntiˈsəʊʃəl/',
									pos: 'n.',
									translationZh: '反社会的',
								},
								{
									word: 'antivirus',
									ipa: '/ˌæntiˈvaɪrəs/',
									pos: 'n.',
									translationZh: '抗病毒',
								},
							],
						},
						{
							prefix: 'de-',
							meaning: '去除，向下，相反',
							examples: [
								{
									word: 'decrease',
									ipa: '/dɪˈkriːs/',
									pos: 'v.',
									translationZh: '减少',
								},
								{
									word: 'decode',
									ipa: '/ˌdiːˈkəʊd/',
									pos: 'v.',
									translationZh: '解码',
								},
								{
									word: 'defrost',
									ipa: '/ˌdiːˈfrɒst/',
									pos: 'v.',
									translationZh: '除霜',
								},
							],
						},
						{
							prefix: 'counter-',
							meaning: '相反，对抗',
							examples: [
								{
									word: 'counterattack',
									ipa: '/ˈkaʊntərəˌtæk/',
									pos: 'n.',
									translationZh: '反击',
								},
								{
									word: 'counterclockwise',
									ipa: '/ˌkaʊntəˈklɒkwaɪz/',
									pos: 'adv.',
									translationZh: '逆时针',
								},
								{
									word: 'counterpart',
									ipa: '/ˈkaʊntəpɑːt/',
									pos: 'n.',
									translationZh: '对应物',
								},
							],
						},
					],
				},
				{
					name: '方向/位置前缀',
					items: [
						{
							prefix: 'pre-',
							meaning: '前，预先',
							examples: [
								{
									word: 'preview',
									ipa: '/ˈpriːvjuː/',
									pos: 'v.',
									translationZh: '预览',
								},
								{
									word: 'prepare',
									ipa: '/prɪˈpeə/',
									pos: 'v.',
									translationZh: '准备',
								},
								{
									word: 'prefix',
									ipa: '/ˈpriːfɪks/',
									pos: 'n.',
									translationZh: '前缀',
								},
							],
						},
						{
							prefix: 'post-',
							meaning: '后，之后',
							examples: [
								{
									word: 'postwar',
									ipa: '/ˌpəʊstˈwɔː/',
									pos: 'n.',
									translationZh: '战后的',
								},
								{
									word: 'postpone',
									ipa: '/pəˈspəʊn/',
									pos: 'n.',
									translationZh: '推迟',
								},
								{
									word: 'postgraduate',
									ipa: '/ˌpəʊstˈɡrædʒuət/',
									pos: 'v.',
									translationZh: '研究生',
								},
							],
						},
						{
							prefix: 'fore-',
							meaning: '前，预先',
							examples: [
								{
									word: 'forehead',
									ipa: '/ˈfɒrɪd/',
									pos: 'n.',
									translationZh: '前额',
								},
								{
									word: 'forecast',
									ipa: '/ˈfɔːkɑːst/',
									pos: 'n.',
									translationZh: '预报',
								},
								{
									word: 'foresee',
									ipa: '/fɔːˈsiː/',
									pos: 'n.',
									translationZh: '预见',
								},
							],
						},
						{
							prefix: 'sub-',
							meaning: '下，次，副',
							examples: [
								{
									word: 'subway',
									ipa: '/ˈsʌbweɪ/',
									pos: 'adj.',
									translationZh: '地铁',
								},
								{
									word: 'submarine',
									ipa: '/ˌsʌbməˈriːn/',
									pos: 'n.',
									translationZh: '潜艇',
								},
								{
									word: 'subtitle',
									ipa: '/sˈʌbtˌaɪtəl/',
									pos: 'n.',
									translationZh: '字幕',
								},
							],
						},
						{
							prefix: 'super-',
							meaning: '上，超，超级',
							examples: [
								{
									word: 'supermarket',
									ipa: '/ˈsuːpəmɑːkɪt/',
									pos: 'n.',
									translationZh: '超市',
								},
								{
									word: 'superman',
									ipa: '/ˈsuːpəmæn/',
									pos: 'n.',
									translationZh: '超人',
								},
								{
									word: 'supernatural',
									ipa: '/sˌuːpənˈætʃəəl/',
									pos: 'n.',
									translationZh: '超自然的',
								},
							],
						},
						{
							prefix: 'over-',
							meaning: '上，超过，过度',
							examples: [
								{
									word: 'overhead',
									ipa: '/ˈəʊvəhed/',
									pos: 'n.',
									translationZh: '头顶上',
								},
								{
									word: 'overcome',
									ipa: '/ˌəʊvəˈkʌm/',
									pos: 'n.',
									translationZh: '克服',
								},
								{
									word: 'overtime',
									ipa: '/ˈəʊvətˌaɪm/',
									pos: 'n.',
									translationZh: '加班',
								},
							],
						},
						{
							prefix: 'under-',
							meaning: '下，不足',
							examples: [
								{
									word: 'underground',
									ipa: '/ˈʌndəɡraʊnd/',
									pos: 'n.',
									translationZh: '地下',
								},
								{
									word: 'underwater',
									ipa: '/ˈʌndəwˌɔːtə/',
									pos: 'n.',
									translationZh: '水下',
								},
								{
									word: 'underestimate',
									ipa: '/ˈʌndəˈestəmˌeɪt/',
									pos: 'v.',
									translationZh: '低估',
								},
							],
						},
						{
							prefix: 'inter-',
							meaning: '之间，相互',
							examples: [
								{
									word: 'international',
									ipa: '/ˌɪntəˈnæʃnəl/',
									pos: 'adj.',
									translationZh: '国际的',
								},
								{
									word: 'interview',
									ipa: '/ˈɪntəvjˌuː/',
									pos: 'n.',
									translationZh: '面试',
								},
								{
									word: 'internet',
									ipa: '/ˈɪntənet/',
									pos: 'n.',
									translationZh: '互联网',
								},
							],
						},
						{
							prefix: 'trans-',
							meaning: '横过，转移，变换',
							examples: [
								{
									word: 'transport',
									ipa: '/trænspˈɔːrt/',
									pos: 'v.',
									translationZh: '运输',
								},
								{
									word: 'translate',
									ipa: '/trænzlˈeɪt/',
									pos: 'v.',
									translationZh: '翻译',
								},
								{
									word: 'transform',
									ipa: '/trænsfˈɔːrm/',
									pos: 'v.',
									translationZh: '转变',
								},
							],
						},
						{
							prefix: 'ex-',
							meaning: '出，外，前',
							examples: [
								{
									word: 'exit',
									ipa: '/ˈeɡzɪt/',
									pos: 'n.',
									translationZh: '出口',
								},
								{
									word: 'export',
									ipa: '/ˈekspɔːrt/',
									pos: 'v.',
									translationZh: '出口',
								},
								{
									word: 'ex-president',
									ipa: '/ˈeks-prˈezɪdənt/',
									pos: 'n./adj.',
									translationZh: '前总统',
								},
							],
						},
						{
							prefix: 'extra-',
							meaning: '外，额外',
							examples: [
								{
									word: 'extraordinary',
									ipa: '/ˌekstrəˈɔːrdənˌeriː/',
									pos: 'n.',
									translationZh: '非凡的',
								},
								{
									word: 'extracurricular',
									ipa: '/ˌekstrəkəˈɪkjələ/',
									pos: 'n.',
									translationZh: '课外的',
								},
								{
									word: 'external',
									ipa: '/ɪkstˈɜːnəl/',
									pos: 'adj.',
									translationZh: '外部的',
								},
							],
						},
						{
							prefix: 'intro-/intra-',
							meaning: '内，向内',
							examples: [
								{
									word: 'introduce',
									ipa: '/ˌɪntrədˈuːs/',
									pos: 'v.',
									translationZh: '介绍',
								},
								{
									word: 'introspect',
									ipa: '/ˈɪntrəspˌekt/',
									pos: 'v.',
									translationZh: '内省',
								},
								{
									word: 'intranet',
									ipa: '/ˈɪntrənet/',
									pos: 'n.',
									translationZh: '内联网',
								},
							],
						},
						{
							prefix: 'circum-',
							meaning: '周围，环绕',
							examples: [
								{
									word: 'circumstance',
									ipa: '/sˈɜːkəmstˌæns/',
									pos: 'n.',
									translationZh: '环境',
								},
								{
									word: 'circumference',
									ipa: '/sˌɜːkˈʌmfrəns/',
									pos: 'n.',
									translationZh: '圆周',
								},
								{
									word: 'circumnavigate',
									ipa: '/ˌsɜːkəmˈnævɪɡeɪt/',
									pos: 'v.',
									translationZh: '环球航行',
								},
							],
						},
						{
							prefix: 'peri-',
							meaning: '周围，附近',
							examples: [
								{
									word: 'perimeter',
									ipa: '/pəˈɪmətə/',
									pos: 'n.',
									translationZh: '周长',
								},
								{
									word: 'period',
									ipa: '/pˈɪriːəd/',
									pos: 'n.',
									translationZh: '时期',
								},
								{
									word: 'periscope',
									ipa: '/pˈerəskˌəʊp/',
									pos: 'n.',
									translationZh: '潜望镜',
								},
							],
						},
					],
				},
				{
					name: '数量/程度前缀',
					items: [
						{
							prefix: 'mono-',
							meaning: '单一',
							examples: [
								{
									word: 'monologue',
									ipa: '/ˈmɒnəlɒɡ/',
									pos: 'n.',
									translationZh: '独白',
								},
								{
									word: 'monopoly',
									ipa: '/məˈnɒpəli/',
									pos: 'adv.',
									translationZh: '垄断',
								},
								{
									word: 'monotone',
									ipa: '/ˈmɒnətəʊn/',
									pos: 'n.',
									translationZh: '单调',
								},
							],
						},
						{
							prefix: 'uni-',
							meaning: '一，单',
							examples: [
								{
									word: 'uniform',
									ipa: '/ˈjuːnɪfɔːm/',
									pos: 'n.',
									translationZh: '制服',
								},
								{
									word: 'unique',
									ipa: '/juːˈniːk/',
									pos: 'n.',
									translationZh: '独特的',
								},
								{
									word: 'unite',
									ipa: '/juːˈnaɪt/',
									pos: 'n.',
									translationZh: '联合',
								},
							],
						},
						{
							prefix: 'bi-',
							meaning: '二，双',
							examples: [
								{
									word: 'bicycle',
									ipa: '/ˈbaɪsɪkəl/',
									pos: 'n.',
									translationZh: '自行车',
								},
								{
									word: 'bilingual',
									ipa: '/baɪˈlɪŋɡwəl/',
									pos: 'adj.',
									translationZh: '双语的',
								},
								{
									word: 'bilateral',
									ipa: '/baɪˈlætərəl/',
									pos: 'n.',
									translationZh: '双边的',
								},
							],
						},
						{
							prefix: 'di-',
							meaning: '二，双',
							examples: [
								{
									word: 'dioxide',
									ipa: '/daɪˈɑːksˌaɪd/',
									pos: 'n.',
									translationZh: '二氧化物',
								},
								{
									word: 'dialogue',
									ipa: '/dˈaɪəlˌɔːɡ/',
									pos: 'n.',
									translationZh: '对话',
								},
								{
									word: 'dilemma',
									ipa: '/dɪlˈemə/',
									pos: 'n.',
									translationZh: '两难',
								},
							],
						},
						{
							prefix: 'tri-',
							meaning: '三',
							examples: [
								{
									word: 'triangle',
									ipa: '/ˈtraɪæŋɡəl/',
									pos: 'n.',
									translationZh: '三角形',
								},
								{
									word: 'tricycle',
									ipa: '/ˈtraɪsɪkəl/',
									pos: 'n.',
									translationZh: '三轮车',
								},
								{
									word: 'trilogy',
									ipa: '/trˈɪlədʒiː/',
									pos: 'n.',
									translationZh: '三部曲',
								},
							],
						},
						{
							prefix: 'multi-',
							meaning: '多',
							examples: [
								{
									word: 'multimedia',
									ipa: '/mˌʌltiːmˈiːdiːə/',
									pos: 'n.',
									translationZh: '多媒体',
								},
								{
									word: 'multinational',
									ipa: '/mˌʌltˌaɪnˈæʃənəl/',
									pos: 'adj.',
									translationZh: '跨国的',
								},
								{
									word: 'multiple',
									ipa: '/mˈʌltəpəl/',
									pos: 'n.',
									translationZh: '多样的',
								},
							],
						},
						{
							prefix: 'poly-',
							meaning: '多',
							examples: [
								{
									word: 'polygon',
									ipa: '/ˈpɒliɡɒn/',
									pos: 'n.',
									translationZh: '多边形',
								},
								{
									word: 'polyglot',
									ipa: '/ˈpɒliɡlɒt/',
									pos: 'n.',
									translationZh: '通晓多种语言的人',
								},
								{
									word: 'polymer',
									ipa: '/pˈɑːləmə/',
									pos: 'n.',
									translationZh: '聚合物',
								},
							],
						},
						{
							prefix: 'semi-',
							meaning: '半',
							examples: [
								{
									word: 'semicircle',
									ipa: '/ˈsemiˌsɜːkəl/',
									pos: 'n.',
									translationZh: '半圆',
								},
								{
									word: 'semiconductor',
									ipa: '/ˌsemikənˈdʌktə/',
									pos: 'n.',
									translationZh: '半导体',
								},
								{
									word: 'semifinal',
									ipa: '/ˌsemiˈfaɪnəl/',
									pos: 'adj.',
									translationZh: '半决赛',
								},
							],
						},
						{
							prefix: 'hemi-',
							meaning: '半',
							examples: [
								{
									word: 'hemisphere',
									ipa: '/hˈemɪsfˌɪr/',
									pos: 'n.',
									translationZh: '半球',
								},
								{
									word: 'hemiplegia',
									ipa: '/hˌeməplˈiːdʒiːə/',
									pos: 'n.',
									translationZh: '偏瘫',
								},
							],
						},
						{
							prefix: 'micro-',
							meaning: '微小',
							examples: [
								{
									word: 'microscope',
									ipa: '/ˈmaɪkrəskəʊp/',
									pos: 'n.',
									translationZh: '显微镜',
								},
								{
									word: 'microwave',
									ipa: '/ˈmaɪkrəweɪv/',
									pos: 'n.',
									translationZh: '微波',
								},
								{
									word: 'microorganism',
									ipa: '/mˌaɪkrəʊˈɔːrɡənˌɪzəm/',
									pos: 'n.',
									translationZh: '微生物',
								},
							],
						},
						{
							prefix: 'mini-',
							meaning: '小',
							examples: [
								{
									word: 'minibus',
									ipa: '/ˈmɪnibʌs/',
									pos: 'n.',
									translationZh: '小巴士',
								},
								{
									word: 'minimize',
									ipa: '/mˈɪnəmˌaɪz/',
									pos: 'v.',
									translationZh: '最小化',
								},
								{
									word: 'minimum',
									ipa: '/ˈmɪnɪməm/',
									pos: 'n.',
									translationZh: '最小值',
								},
							],
						},
						{
							prefix: 'macro-',
							meaning: '大，宏观',
							examples: [
								{
									word: 'macroeconomics',
									ipa: '/mˌækrəʊekənˈɑːmɪks/',
									pos: 'n.',
									translationZh: '宏观经济学',
								},
								{
									word: 'macroscope',
									ipa: '/ˈmækrəskəʊp/',
									pos: 'n.',
									translationZh: '宏观观察',
								},
							],
						},
						{
							prefix: 'mega-',
							meaning: '百万，巨大',
							examples: [
								{
									word: 'megabyte',
									ipa: '/mˈeɡəbˌaɪt/',
									pos: 'n.',
									translationZh: '兆字节',
								},
								{
									word: 'megacity',
									ipa: '/ˈmeɡəsɪti/',
									pos: 'n.',
									translationZh: '特大城市',
								},
								{
									word: 'megaphone',
									ipa: '/ˈmeɡəfəʊn/',
									pos: 'n.',
									translationZh: '扩音器',
								},
							],
						},
						{
							prefix: 'kilo-',
							meaning: '千',
							examples: [
								{
									word: 'kilometer',
									ipa: '/kəlˈɑːmətə/',
									pos: 'n.',
									translationZh: '千米',
								},
								{
									word: 'kilogram',
									ipa: '/kˈɪləɡrˌæm/',
									pos: 'n.',
									translationZh: '千克',
								},
								{
									word: 'kilowatt',
									ipa: '/kˈɪləwˌɑːt/',
									pos: 'n.',
									translationZh: '千瓦',
								},
							],
						},
						{
							prefix: 'milli-',
							meaning: '千分之一',
							examples: [
								{
									word: 'millimeter',
									ipa: '/mˈɪləmˌiːtə/',
									pos: 'n.',
									translationZh: '毫米',
								},
								{
									word: 'millisecond',
									ipa: '/mˈɪlɪsˌekənd/',
									pos: 'n.',
									translationZh: '毫秒',
								},
								{
									word: 'milligram',
									ipa: '/mˈɪləɡrˌæm/',
									pos: 'n.',
									translationZh: '毫克',
								},
							],
						},
					],
				},
				{
					name: '其他重要前缀',
					items: [
						{
							prefix: 're-',
							meaning: '再，重新，回',
							examples: [
								{
									word: 'rewrite',
									ipa: '/riːˈraɪt/',
									pos: 'v.',
									translationZh: '重写',
								},
								{
									word: 'return',
									ipa: '/rɪˈtɜːn/',
									pos: 'v.',
									translationZh: '返回',
								},
								{
									word: 'recycle',
									ipa: '/riːˈsaɪkəl/',
									pos: 'v.',
									translationZh: '回收',
								},
							],
						},
						{
							prefix: 'co-',
							meaning: '共同，一起',
							examples: [
								{
									word: 'cooperate',
									ipa: '/kəʊˈɑːpəˌeɪt/',
									pos: 'v.',
									translationZh: '合作',
								},
								{
									word: 'coexist',
									ipa: '/kˌəʊəɡzˈɪst/',
									pos: 'v.',
									translationZh: '共存',
								},
								{
									word: 'coauthor',
									ipa: '/kˈəʊˈɑːθə/',
									pos: 'n.',
									translationZh: '合著者',
								},
							],
						},
						{
							prefix: 'con-/com-/col-/cor-',
							meaning: '共同，一起，加强',
							examples: [
								{
									word: 'connect',
									ipa: '/kənˈekt/',
									pos: 'v.',
									translationZh: '连接',
								},
								{
									word: 'combine',
									ipa: '/kˈɑːmbaɪn/',
									pos: 'v.',
									translationZh: '结合',
								},
								{
									word: 'collect',
									ipa: '/kəlˈekt/',
									pos: 'v.',
									translationZh: '收集',
								},
								{
									word: 'correct',
									ipa: '/kəˈekt/',
									pos: 'v.',
									translationZh: '纠正',
								},
							],
						},
						{
							prefix: 'sym-/syn-',
							meaning: '共同，相同',
							examples: [
								{
									word: 'sympathy',
									ipa: '/sˈɪmpəθiː/',
									pos: 'adj.',
									translationZh: '同情',
								},
								{
									word: 'synchronize',
									ipa: '/sˈɪŋkrənˌaɪz/',
									pos: 'v.',
									translationZh: '同步',
								},
								{
									word: 'synthesis',
									ipa: '/sˈɪnθəsəs/',
									pos: 'n.',
									translationZh: '合成',
								},
							],
						},
						{
							prefix: 'auto-',
							meaning: '自动，自己',
							examples: [
								{
									word: 'automatic',
									ipa: '/ˌɔːtəˈmætɪk/',
									pos: 'adj.',
									translationZh: '自动的',
								},
								{
									word: 'autonomy',
									ipa: '/ɔːˈtɒnəmi/',
									pos: 'adj.',
									translationZh: '自治',
								},
								{
									word: 'autobiography',
									ipa: '/ˌɔːtəbaɪˈɒɡrəfi/',
									pos: 'n.',
									translationZh: '自传',
								},
							],
						},
						{
							prefix: 'bio-',
							meaning: '生命，生物',
							examples: [
								{
									word: 'biology',
									ipa: '/baɪˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '生物学',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
								{
									word: 'biodegradable',
									ipa: '/bˌaɪəʊdəɡrˈeɪdəbəl/',
									pos: 'adj.',
									translationZh: '可生物降解的',
								},
							],
						},
						{
							prefix: 'geo-',
							meaning: '地球，土地',
							examples: [
								{
									word: 'geography',
									ipa: '/dʒiːˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '地理',
								},
								{
									word: 'geology',
									ipa: '/dʒiːˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '地质学',
								},
								{
									word: 'geometry',
									ipa: '/dʒiːˈɑːmətriː/',
									pos: 'n.',
									translationZh: '几何',
								},
							],
						},
						{
							prefix: 'tele-',
							meaning: '远，电信',
							examples: [
								{
									word: 'telephone',
									ipa: '/tˈeləfˌəʊn/',
									pos: 'n.',
									translationZh: '电话',
								},
								{
									word: 'television',
									ipa: '/tˈeləvˌɪʒən/',
									pos: 'n.',
									translationZh: '电视',
								},
								{
									word: 'telecommunication',
									ipa: '/tˌeləkəmjˌuːnɪkˈeɪʃən/',
									pos: 'n.',
									translationZh: '电信',
								},
							],
						},
						{
							prefix: 'photo-',
							meaning: '光',
							examples: [
								{
									word: 'photograph',
									ipa: '/fˈəʊtəɡrˌæf/',
									pos: 'n.',
									translationZh: '照片',
								},
								{
									word: 'photosynthesis',
									ipa: '/fˌəʊtəʊsˈɪnθəsɪs/',
									pos: 'n.',
									translationZh: '光合作用',
								},
								{
									word: 'photon',
									ipa: '/fˈəʊtˌɑːn/',
									pos: 'n.',
									translationZh: '光子',
								},
							],
						},
						{
							prefix: 'therm-',
							meaning: '热',
							examples: [
								{
									word: 'thermometer',
									ipa: '/θəmˈɑːmətə/',
									pos: 'n.',
									translationZh: '温度计',
								},
								{
									word: 'thermal',
									ipa: '/θˈɜːməl/',
									pos: 'n.',
									translationZh: '热的',
								},
								{
									word: 'thermos',
									ipa: '/θˈɜːməs/',
									pos: 'n.',
									translationZh: '保温瓶',
								},
							],
						},
						{
							prefix: 'hydro-',
							meaning: '水',
							examples: [
								{
									word: 'hydrogen',
									ipa: '/hˈaɪdrədʒən/',
									pos: 'n.',
									translationZh: '氢',
								},
								{
									word: 'hydraulic',
									ipa: '/haɪdrˈɔːlɪk/',
									pos: 'adj.',
									translationZh: '液压的',
								},
								{
									word: 'hydroelectric',
									ipa: '/hˌaɪdrəʊɪlˈektrɪk/',
									pos: 'adj.',
									translationZh: '水电的',
								},
							],
						},
						{
							prefix: 'aero-',
							meaning: '空气，航空',
							examples: [
								{
									word: 'aeroplane',
									ipa: '/ˈeərəpleɪn/',
									pos: 'n.',
									translationZh: '飞机',
								},
								{
									word: 'aerospace',
									ipa: '/ˈerəʊspˌeɪs/',
									pos: 'n.',
									translationZh: '航空航天',
								},
								{
									word: 'aerodynamics',
									ipa: '/ˌeərəʊdaɪˈnæmɪks/',
									pos: 'n.',
									translationZh: '空气动力学',
								},
							],
						},
						{
							prefix: 'neo-',
							meaning: '新',
							examples: [
								{
									word: 'neoclassical',
									ipa: '/nˌiːəʊklˈæsɪkəl/',
									pos: 'adj.',
									translationZh: '新古典主义的',
								},
								{
									word: 'neonatal',
									ipa: '/nˌiːəʊnˈeɪtəl/',
									pos: 'n.',
									translationZh: '新生儿的',
								},
								{
									word: 'neolithic',
									ipa: '/ˌniːəˈlɪθɪk/',
									pos: 'adj.',
									translationZh: '新石器时代的',
								},
							],
						},
						{
							prefix: 'paleo-',
							meaning: '古，旧',
							examples: [
								{
									word: 'paleontology',
									ipa: '/pˌeɪliːəntˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '古生物学',
								},
								{
									word: 'Paleolithic',
									ipa: '/ˌpæliəˈlɪθɪk/',
									pos: 'adj.',
									translationZh: '旧石器时代的',
								},
							],
						},
						{
							prefix: 'pseudo-',
							meaning: '假，伪',
							examples: [
								{
									word: 'pseudonym',
									ipa: '/ˈsuːdənɪm/',
									pos: 'n.',
									translationZh: '笔名',
								},
								{
									word: 'pseudoscience',
									ipa: '/ˌsuːdəʊˈsaɪəns/',
									pos: 'n.',
									translationZh: '伪科学',
								},
							],
						},
						{
							prefix: 'homo-',
							meaning: '同，相同',
							examples: [
								{
									word: 'homogeneous',
									ipa: '/hˌəʊmədʒˈiːniːəs/',
									pos: 'adj.',
									translationZh: '同质的',
								},
								{
									word: 'homosexual',
									ipa: '/hˌəʊməʊsˈekʃuːəl/',
									pos: 'n.',
									translationZh: '同性恋的',
								},
								{
									word: 'homonym',
									ipa: '/hˈɔːmənɪm/',
									pos: 'n.',
									translationZh: '同音异义词',
								},
							],
						},
						{
							prefix: 'hetero-',
							meaning: '异，不同',
							examples: [
								{
									word: 'heterogeneous',
									ipa: '/hˌetəədʒˈiːnjəs/',
									pos: 'adj.',
									translationZh: '异质的',
								},
								{
									word: 'heterosexual',
									ipa: '/hˌetəəʊsˈekʃˌuːəl/',
									pos: 'n.',
									translationZh: '异性恋的',
								},
							],
						},
						{
							prefix: 'eu-',
							meaning: '好，优秀',
							examples: [
								{
									word: 'euphemism',
									ipa: '/jˈuːfəmˌɪzəm/',
									pos: 'n.',
									translationZh: '委婉语',
								},
								{
									word: 'euphoria',
									ipa: '/juːfˈɔːriːə/',
									pos: 'n.',
									translationZh: '欣快',
								},
								{
									word: 'eugenics',
									ipa: '/juːdʒˈenɪks/',
									pos: 'n.',
									translationZh: '优生学',
								},
							],
						},
						{
							prefix: 'mal-',
							meaning: '坏，不良',
							examples: [
								{
									word: 'malfunction',
									ipa: '/mælfˈʌŋkʃən/',
									pos: 'n.',
									translationZh: '故障',
								},
								{
									word: 'malnutrition',
									ipa: '/mˌælnuːtrˈɪʃən/',
									pos: 'n.',
									translationZh: '营养不良',
								},
								{
									word: 'malpractice',
									ipa: '/mælprˈæktəs/',
									pos: 'n.',
									translationZh: '渎职',
								},
							],
						},
						{
							prefix: 'dys-',
							meaning: '困难，不良',
							examples: [
								{
									word: 'dysfunction',
									ipa: '/dɪsfˈʌŋkʃən/',
									pos: 'n.',
									translationZh: '功能障碍',
								},
								{
									word: 'dyslexia',
									ipa: '/dɪslˈeksiːə/',
									pos: 'n.',
									translationZh: '阅读障碍',
								},
								{
									word: 'dyspnea',
									ipa: '/dˌɪspnˈiːə/',
									pos: 'n.',
									translationZh: '呼吸困难',
								},
							],
						},
						{
							prefix: 'hyper-',
							meaning: '超过，过度',
							examples: [
								{
									word: 'hyperactive',
									ipa: '/hˌaɪpəˈæktɪv/',
									pos: 'adj.',
									translationZh: '过度活跃的',
								},
								{
									word: 'hypertension',
									ipa: '/hˌaɪpətˈenʃən/',
									pos: 'n.',
									translationZh: '高血压',
								},
								{
									word: 'hyperlink',
									ipa: '/hˈaɪpəlɪŋk/',
									pos: 'n.',
									translationZh: '超链接',
								},
							],
						},
						{
							prefix: 'hypo-',
							meaning: '低于，不足',
							examples: [
								{
									word: 'hypothermia',
									ipa: '/hˌaɪpəθˈɜːmiːə/',
									pos: 'n.',
									translationZh: '低温',
								},
								{
									word: 'hypothesis',
									ipa: '/haɪpˈɑːθəsəs/',
									pos: 'n.',
									translationZh: '假设',
								},
								{
									word: 'hypotension',
									ipa: '/hˌaɪpəʊtˈenʃən/',
									pos: 'n.',
									translationZh: '低血压',
								},
							],
						},
						{
							prefix: 'pro-',
							meaning: '向前，支持',
							examples: [
								{
									word: 'progress',
									ipa: '/prˈɑːɡrˌes/',
									pos: 'v.',
									translationZh: '进步',
								},
								{
									word: 'promote',
									ipa: '/prəmˈəʊt/',
									pos: 'n.',
									translationZh: '促进',
								},
								{
									word: 'pro-government',
									ipa: '/prˈəʊ-ɡˈʌvənmənt/',
									pos: 'n.',
									translationZh: '亲政府的',
								},
							],
						},
						{
							prefix: 'en-/em-',
							meaning: '使，使进入',
							examples: [
								{
									word: 'enable',
									ipa: '/enˈeɪbəl/',
									pos: 'v.',
									translationZh: '使能够',
								},
								{
									word: 'enlarge',
									ipa: '/ˌenlˈɑːrdʒ/',
									pos: 'v.',
									translationZh: '扩大',
								},
								{
									word: 'embrace',
									ipa: '/embrˈeɪs/',
									pos: 'v.',
									translationZh: '拥抱',
								},
							],
						},
						{
							prefix: 'be-',
							meaning: '使，加以',
							examples: [
								{
									word: 'befriend',
									ipa: '/bɪfrˈend/',
									pos: 'n.',
									translationZh: '以友相待',
								},
								{
									word: 'belittle',
									ipa: '/bɪlˈɪtəl/',
									pos: 'n.',
									translationZh: '轻视',
								},
								{
									word: 'bewilder',
									ipa: '/bɪwˈɪldə/',
									pos: 'n.',
									translationZh: '使迷惑',
								},
							],
						},
						{
							prefix: 'out-',
							meaning: '超过，向外',
							examples: [
								{
									word: 'outnumber',
									ipa: '/aʊtˈnʌmbə/',
									pos: 'n.',
									translationZh: '数量超过',
								},
								{
									word: 'outdoor',
									ipa: '/ˈaʊtdɔː/',
									pos: 'n.',
									translationZh: '户外',
								},
								{
									word: 'outstanding',
									ipa: '/ˌaʊtstˈændɪŋ/',
									pos: 'v./adj.',
									translationZh: '杰出的',
								},
							],
						},
						{
							prefix: 'up-',
							meaning: '上，向上',
							examples: [
								{
									word: 'upgrade',
									ipa: '/əpɡrˈeɪd/',
									pos: 'n.',
									translationZh: '升级',
								},
								{
									word: 'uphold',
									ipa: '/əphˈəʊld/',
									pos: 'n.',
									translationZh: '维护',
								},
								{
									word: 'upset',
									ipa: '/əpsˈet/',
									pos: 'n.',
									translationZh: '打乱',
								},
							],
						},
						{
							prefix: 'down-',
							meaning: '下，向下',
							examples: [
								{
									word: 'download',
									ipa: '/dˈaʊnlˌəʊd/',
									pos: 'n.',
									translationZh: '下载',
								},
								{
									word: 'downgrade',
									ipa: '/dˈaʊnɡrˈeɪd/',
									pos: 'n.',
									translationZh: '降级',
								},
								{
									word: 'downfall',
									ipa: '/dˈaʊnfˌɔːl/',
									pos: 'n.',
									translationZh: '垮台',
								},
							],
						},
						{
							prefix: 'with-',
							meaning: '向后，相反',
							examples: [
								{
									word: 'withdraw',
									ipa: '/wɪðdrˈɔː/',
									pos: 'n.',
									translationZh: '撤回',
								},
								{
									word: 'withhold',
									ipa: '/wɪθhˈəʊld/',
									pos: 'n.',
									translationZh: '保留',
								},
								{
									word: 'withstand',
									ipa: '/wɪθstˈænd/',
									pos: 'n.',
									translationZh: '抵抗',
								},
							],
						},
					],
				},
			],
		},
		suffixes: {
			title: '后缀 (Suffixes)',
			description: '后缀是置于词根后面的词缀，可以改变单词的词性和含义',
			categories: [
				{
					name: '名词后缀',
					items: [
						{
							suffix: '-er/-or',
							meaning: '做...的人/物',
							examples: [
								{
									word: 'teacher',
									ipa: '/tˈiːtʃə/',
									pos: 'n.',
									translationZh: '教师',
								},
								{
									word: 'actor',
									ipa: '/ˈæktə/',
									pos: 'n.',
									translationZh: '演员',
								},
								{
									word: 'computer',
									ipa: '/kəmpjˈuːtə/',
									pos: 'n.',
									translationZh: '计算机',
								},
							],
						},
						{
							suffix: '-ist',
							meaning: '...主义者，...专家',
							examples: [
								{
									word: 'scientist',
									ipa: '/sˈaɪəntɪst/',
									pos: 'n.',
									translationZh: '科学家',
								},
								{
									word: 'artist',
									ipa: '/ˈɑːrtəst/',
									pos: 'n.',
									translationZh: '艺术家',
								},
								{
									word: 'tourist',
									ipa: '/tˈʊrəst/',
									pos: 'n.',
									translationZh: '游客',
								},
							],
						},
						{
							suffix: '-ian',
							meaning: '...人，...专家',
							examples: [
								{
									word: 'musician',
									ipa: '/mjuːzˈɪʃən/',
									pos: 'n.',
									translationZh: '音乐家',
								},
								{
									word: 'physician',
									ipa: '/fəzˈɪʃən/',
									pos: 'n.',
									translationZh: '医生',
								},
								{
									word: 'politician',
									ipa: '/pˌɑːlətˈɪʃən/',
									pos: 'n.',
									translationZh: '政治家',
								},
							],
						},
						{
							suffix: '-ant/-ent',
							meaning: '...人，...物',
							examples: [
								{
									word: 'assistant',
									ipa: '/əsˈɪstənt/',
									pos: 'n./adj.',
									translationZh: '助手',
								},
								{
									word: 'student',
									ipa: '/stˈuːdənt/',
									pos: 'n.',
									translationZh: '学生',
								},
								{
									word: 'agent',
									ipa: '/ˈeɪdʒənt/',
									pos: 'n./adj.',
									translationZh: '代理人',
								},
							],
						},
						{
							suffix: '-ee',
							meaning: '被...的人',
							examples: [
								{
									word: 'employee',
									ipa: '/emplˈɔɪiː/',
									pos: 'n.',
									translationZh: '雇员',
								},
								{
									word: 'trainee',
									ipa: '/trˈeɪnˈiː/',
									pos: 'n.',
									translationZh: '受训者',
								},
								{
									word: 'interviewee',
									ipa: '/ˌɪntəvjuːˈiː/',
									pos: 'n.',
									translationZh: '被面试者',
								},
							],
						},
						{
							suffix: '-ess',
							meaning: '女性',
							examples: [
								{
									word: 'actress',
									ipa: '/ˈæktrəs/',
									pos: 'n.',
									translationZh: '女演员',
								},
								{
									word: 'waitress',
									ipa: '/wˈeɪtrəs/',
									pos: 'n.',
									translationZh: '女服务员',
								},
								{
									word: 'hostess',
									ipa: '/hˈəʊstəs/',
									pos: 'n.',
									translationZh: '女主人',
								},
							],
						},
						{
							suffix: '-ness',
							meaning: '性质，状态',
							examples: [
								{
									word: 'happiness',
									ipa: '/hˈæpiːnəs/',
									pos: 'n.',
									translationZh: '幸福',
								},
								{
									word: 'kindness',
									ipa: '/kˈaɪndnəs/',
									pos: 'n.',
									translationZh: '善良',
								},
								{
									word: 'darkness',
									ipa: '/dˈɑːrknəs/',
									pos: 'n.',
									translationZh: '黑暗',
								},
							],
						},
						{
							suffix: '-ment',
							meaning: '行为，结果，状态',
							examples: [
								{
									word: 'movement',
									ipa: '/mˈuːvmənt/',
									pos: 'n.',
									translationZh: '运动',
								},
								{
									word: 'development',
									ipa: '/dɪvˈeləpmənt/',
									pos: 'n.',
									translationZh: '发展',
								},
								{
									word: 'government',
									ipa: '/ɡˈʌvənmənt/',
									pos: 'n.',
									translationZh: '政府',
								},
							],
						},
						{
							suffix: '-tion/-sion/-ation',
							meaning: '行为，状态，结果',
							examples: [
								{
									word: 'action',
									ipa: '/ˈækʃən/',
									pos: 'n.',
									translationZh: '行动',
								},
								{
									word: 'decision',
									ipa: '/dɪsˈɪʒən/',
									pos: 'n.',
									translationZh: '决定',
								},
								{
									word: 'education',
									ipa: '/ˌedʒəkˈeɪʃən/',
									pos: 'n.',
									translationZh: '教育',
								},
							],
						},
						{
							suffix: '-ity/-ty',
							meaning: '性质，状态',
							examples: [
								{
									word: 'reality',
									ipa: '/rˌiːˈælətˌiː/',
									pos: 'n.',
									translationZh: '现实',
								},
								{
									word: 'ability',
									ipa: '/əbˈɪlətˌiː/',
									pos: 'n.',
									translationZh: '能力',
								},
								{
									word: 'safety',
									ipa: '/sˈeɪftiː/',
									pos: 'n.',
									translationZh: '安全',
								},
							],
						},
						{
							suffix: '-ance/-ence',
							meaning: '性质，状态',
							examples: [
								{
									word: 'importance',
									ipa: '/ˌɪmpˈɔːrtəns/',
									pos: 'n.',
									translationZh: '重要性',
								},
								{
									word: 'difference',
									ipa: '/dˈɪfəəns/',
									pos: 'n.',
									translationZh: '差异',
								},
								{
									word: 'existence',
									ipa: '/eɡzˈɪstəns/',
									pos: 'n.',
									translationZh: '存在',
								},
							],
						},
						{
							suffix: '-dom',
							meaning: '领域，状态',
							examples: [
								{
									word: 'freedom',
									ipa: '/frˈiːdəm/',
									pos: 'n.',
									translationZh: '自由',
								},
								{
									word: 'kingdom',
									ipa: '/kˈɪŋdəm/',
									pos: 'n.',
									translationZh: '王国',
								},
								{
									word: 'wisdom',
									ipa: '/wˈɪzdəm/',
									pos: 'n.',
									translationZh: '智慧',
								},
							],
						},
						{
							suffix: '-ship',
							meaning: '关系，身份，技能',
							examples: [
								{
									word: 'friendship',
									ipa: '/frˈendʃɪp/',
									pos: 'n.',
									translationZh: '友谊',
								},
								{
									word: 'leadership',
									ipa: '/lˈiːdəʃˌɪp/',
									pos: 'n.',
									translationZh: '领导力',
								},
								{
									word: 'scholarship',
									ipa: '/skˈɑːləʃˌɪp/',
									pos: 'n.',
									translationZh: '奖学金',
								},
							],
						},
						{
							suffix: '-hood',
							meaning: '状态，时期',
							examples: [
								{
									word: 'childhood',
									ipa: '/tʃˈaɪldhˌʊd/',
									pos: 'n.',
									translationZh: '童年',
								},
								{
									word: 'neighborhood',
									ipa: '/nˈeɪbəhˌʊd/',
									pos: 'n.',
									translationZh: '社区',
								},
								{
									word: 'brotherhood',
									ipa: '/brˈʌðəhˌʊd/',
									pos: 'n.',
									translationZh: '兄弟情谊',
								},
							],
						},
						{
							suffix: '-ism',
							meaning: '主义，学说',
							examples: [
								{
									word: 'capitalism',
									ipa: '/kˈæpɪtəlˌɪzəm/',
									pos: 'n.',
									translationZh: '资本主义',
								},
								{
									word: 'socialism',
									ipa: '/sˈəʊʃəlˌɪzəm/',
									pos: 'n.',
									translationZh: '社会主义',
								},
								{
									word: 'tourism',
									ipa: '/tˈʊrˌɪzəm/',
									pos: 'n.',
									translationZh: '旅游业',
								},
							],
						},
						{
							suffix: '-age',
							meaning: '状态，行为，集合',
							examples: [
								{
									word: 'marriage',
									ipa: '/mˈerɪdʒ/',
									pos: 'n.',
									translationZh: '婚姻',
								},
								{
									word: 'storage',
									ipa: '/stˈɔːrədʒ/',
									pos: 'n.',
									translationZh: '储存',
								},
								{
									word: 'village',
									ipa: '/vˈɪlədʒ/',
									pos: 'n.',
									translationZh: '村庄',
								},
							],
						},
						{
							suffix: '-ure/-ture',
							meaning: '行为，结果，状态',
							examples: [
								{
									word: 'pressure',
									ipa: '/prˈeʃə/',
									pos: 'n.',
									translationZh: '压力',
								},
								{
									word: 'culture',
									ipa: '/kˈʌltʃə/',
									pos: 'n.',
									translationZh: '文化',
								},
								{
									word: 'nature',
									ipa: '/nˈeɪtʃə/',
									pos: 'n.',
									translationZh: '自然',
								},
							],
						},
						{
							suffix: '-cy',
							meaning: '状态，性质',
							examples: [
								{
									word: 'privacy',
									ipa: '/prˈaɪvəsiː/',
									pos: 'n.',
									translationZh: '隐私',
								},
								{
									word: 'accuracy',
									ipa: '/ˈækjəəsiː/',
									pos: 'n.',
									translationZh: '准确性',
								},
								{
									word: 'democracy',
									ipa: '/dɪmˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '民主',
								},
							],
						},
						{
							suffix: '-al',
							meaning: '行为，过程',
							examples: [
								{
									word: 'arrival',
									ipa: '/əˈaɪvəl/',
									pos: 'n.',
									translationZh: '到达',
								},
								{
									word: 'refusal',
									ipa: '/rəfjˈuːzəl/',
									pos: 'n.',
									translationZh: '拒绝',
								},
								{
									word: 'approval',
									ipa: '/əprˈuːvəl/',
									pos: 'n.',
									translationZh: '批准',
								},
							],
						},
						{
							suffix: '-ing',
							meaning: '行为，结果，材料',
							examples: [
								{
									word: 'building',
									ipa: '/bˈɪldɪŋ/',
									pos: 'v./adj.',
									translationZh: '建筑物',
								},
								{
									word: 'painting',
									ipa: '/pˈeɪntɪŋ/',
									pos: 'v./adj.',
									translationZh: '绘画',
								},
								{
									word: 'clothing',
									ipa: '/klˈəʊðɪŋ/',
									pos: 'v./adj.',
									translationZh: '服装',
								},
							],
						},
						{
							suffix: '-let',
							meaning: '小',
							examples: [
								{
									word: 'booklet',
									ipa: '/bˈʊklɪt/',
									pos: 'n.',
									translationZh: '小册子',
								},
								{
									word: 'leaflet',
									ipa: '/lˈiːflət/',
									pos: 'n.',
									translationZh: '传单',
								},
								{
									word: 'starlet',
									ipa: '/stˈɑːrlət/',
									pos: 'n.',
									translationZh: '小明星',
								},
							],
						},
						{
							suffix: '-ette',
							meaning: '小，女性',
							examples: [
								{
									word: 'cigarette',
									ipa: '/sˌɪɡərˈet/',
									pos: 'n.',
									translationZh: '香烟',
								},
								{
									word: 'kitchenette',
									ipa: '/kˌɪtʃənˈet/',
									pos: 'n.',
									translationZh: '小厨房',
								},
								{
									word: 'suffragette',
									ipa: '/sˌʌfrədʒˈet/',
									pos: 'n.',
									translationZh: '女权主义者',
								},
							],
						},
						{
							suffix: '-ful',
							meaning: '充满...的量',
							examples: [
								{
									word: 'handful',
									ipa: '/hˈændfˌʊl/',
									pos: 'adj.',
									translationZh: '一把',
								},
								{
									word: 'mouthful',
									ipa: '/mˈaʊθfˌʊl/',
									pos: 'adj.',
									translationZh: '一口',
								},
								{
									word: 'spoonful',
									ipa: '/spˈuːnfˌʊl/',
									pos: 'adj.',
									translationZh: '一匙',
								},
							],
						},
						{
							suffix: '-th',
							meaning: '序数，性质',
							examples: [
								{
									word: 'fourth',
									ipa: '/fˈɔːrθ/',
									pos: 'n.',
									translationZh: '第四',
								},
								{
									word: 'depth',
									ipa: '/dˈepθ/',
									pos: 'n.',
									translationZh: '深度',
								},
								{
									word: 'growth',
									ipa: '/ɡrˈəʊθ/',
									pos: 'n.',
									translationZh: '生长',
								},
							],
						},
						{
							suffix: '-logy',
							meaning: '学科，研究',
							examples: [
								{
									word: 'biology',
									ipa: '/baɪˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '生物学',
								},
								{
									word: 'psychology',
									ipa: '/saɪkˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '心理学',
								},
								{
									word: 'technology',
									ipa: '/teknˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '技术',
								},
							],
						},
						{
							suffix: '-graphy',
							meaning: '书写，记录',
							examples: [
								{
									word: 'photography',
									ipa: '/fətˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '摄影',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
								{
									word: 'geography',
									ipa: '/dʒiːˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '地理',
								},
							],
						},
						{
							suffix: '-meter',
							meaning: '测量仪器',
							examples: [
								{
									word: 'thermometer',
									ipa: '/θəmˈɑːmətə/',
									pos: 'n.',
									translationZh: '温度计',
								},
								{
									word: 'barometer',
									ipa: '/bəˈɑːmɪtə/',
									pos: 'n.',
									translationZh: '气压计',
								},
								{
									word: 'speedometer',
									ipa: '/spiːdˈɑːmətə/',
									pos: 'n.',
									translationZh: '速度计',
								},
							],
						},
						{
							suffix: '-scope',
							meaning: '观察仪器',
							examples: [
								{
									word: 'telescope',
									ipa: '/tˈeləskˌəʊp/',
									pos: 'n.',
									translationZh: '望远镜',
								},
								{
									word: 'microscope',
									ipa: '/ˈmaɪkrəskəʊp/',
									pos: 'n.',
									translationZh: '显微镜',
								},
								{
									word: 'stethoscope',
									ipa: '/stˈeθəskˌəʊp/',
									pos: 'n.',
									translationZh: '听诊器',
								},
							],
						},
						{
							suffix: '-cide',
							meaning: '杀',
							examples: [
								{
									word: 'suicide',
									ipa: '/sˈuːəsˌaɪd/',
									pos: 'n.',
									translationZh: '自杀',
								},
								{
									word: 'pesticide',
									ipa: '/pˈestəsˌaɪd/',
									pos: 'n.',
									translationZh: '杀虫剂',
								},
								{
									word: 'homicide',
									ipa: '/hˈɑːməsˌaɪd/',
									pos: 'n.',
									translationZh: '杀人',
								},
							],
						},
						{
							suffix: '-phobia',
							meaning: '恐惧症',
							examples: [
								{
									word: 'claustrophobia',
									ipa: '/klˌɔːstrəfˈəʊbiːə/',
									pos: 'n.',
									translationZh: '幽闭恐惧症',
								},
								{
									word: 'acrophobia',
									ipa: '/əˈkrəʊfəʊbiə/',
									pos: 'n.',
									translationZh: '恐高症',
								},
								{
									word: 'hydrophobia',
									ipa: '/ˌhaɪdrəˈfəʊbiə/',
									pos: 'n.',
									translationZh: '恐水症',
								},
							],
						},
						{
							suffix: '-mania',
							meaning: '狂热',
							examples: [
								{
									word: 'bibliomania',
									ipa: '/ˌbɪbliəˈmeɪniə/',
									pos: 'n.',
									translationZh: '藏书狂',
								},
								{
									word: 'kleptomania',
									ipa: '/ˌkleptəˈmeɪniə/',
									pos: 'n.',
									translationZh: '盗窃癖',
								},
							],
						},
						{
							suffix: '-cracy',
							meaning: '统治，政体',
							examples: [
								{
									word: 'democracy',
									ipa: '/dɪmˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '民主',
								},
								{
									word: 'bureaucracy',
									ipa: '/bjʊrˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '官僚',
								},
								{
									word: 'aristocracy',
									ipa: '/ˌerəstˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '贵族',
								},
							],
						},
						{
							suffix: '-archy',
							meaning: '统治',
							examples: [
								{
									word: 'monarchy',
									ipa: '/mˈɑːnɑːrkiː/',
									pos: 'n.',
									translationZh: '君主制',
								},
								{
									word: 'anarchy',
									ipa: '/ˈænəkˌiː/',
									pos: 'n.',
									translationZh: '无政府状态',
								},
								{
									word: 'hierarchy',
									ipa: '/hˈaɪəˌɑːrkiː/',
									pos: 'n.',
									translationZh: '等级制度',
								},
							],
						},
						{
							suffix: '-itis',
							meaning: '炎症',
							examples: [
								{
									word: 'bronchitis',
									ipa: '/brɒŋˈkaɪtɪs/',
									pos: 'n.',
									translationZh: '支气管炎',
								},
								{
									word: 'tonsillitis',
									ipa: '/ˌtɒnsɪˈlaɪtɪs/',
									pos: 'n.',
									translationZh: '扁桃体炎',
								},
								{
									word: 'arthritis',
									ipa: '/ɑːrθrˈaɪtəs/',
									pos: 'n.',
									translationZh: '关节炎',
								},
							],
						},
						{
							suffix: '-osis',
							meaning: '病态，过程',
							examples: [
								{
									word: 'hypnosis',
									ipa: '/hɪpˈnəʊsɪs/',
									pos: 'n.',
									translationZh: '催眠',
								},
								{
									word: 'neurosis',
									ipa: '/nʊrˈəʊsəs/',
									pos: 'n.',
									translationZh: '神经症',
								},
								{
									word: 'tuberculosis',
									ipa: '/təbˌɜːkjəlˈəʊsɪs/',
									pos: 'n.',
									translationZh: '肺结核',
								},
							],
						},
					],
				},
				{
					name: '形容词后缀',
					items: [
						{
							suffix: '-able/-ible',
							meaning: '能够...的，可...的',
							examples: [
								{
									word: 'comfortable',
									ipa: '/kˈʌmfətəbəl/',
									pos: 'adj.',
									translationZh: '舒适的',
								},
								{
									word: 'visible',
									ipa: '/vˈɪzəbəl/',
									pos: 'adj.',
									translationZh: '可见的',
								},
								{
									word: 'flexible',
									ipa: '/flˈeksəbəl/',
									pos: 'adj.',
									translationZh: '灵活的',
								},
							],
						},
						{
							suffix: '-al/-ial',
							meaning: '...的，与...有关的',
							examples: [
								{
									word: 'natural',
									ipa: '/nˈætʃəəl/',
									pos: 'adj.',
									translationZh: '自然的',
								},
								{
									word: 'national',
									ipa: '/nˈæʃənəl/',
									pos: 'adj.',
									translationZh: '国家的',
								},
								{
									word: 'industrial',
									ipa: '/ˌɪndˈʌstriːəl/',
									pos: 'n.',
									translationZh: '工业的',
								},
							],
						},
						{
							suffix: '-ful',
							meaning: '充满...的',
							examples: [
								{
									word: 'beautiful',
									ipa: '/bjˈuːtəfəl/',
									pos: 'adj.',
									translationZh: '美丽的',
								},
								{
									word: 'helpful',
									ipa: '/hˈelpfəl/',
									pos: 'adj.',
									translationZh: '有帮助的',
								},
								{
									word: 'careful',
									ipa: '/kˈerfəl/',
									pos: 'adj.',
									translationZh: '小心的',
								},
							],
						},
						{
							suffix: '-less',
							meaning: '无...的',
							examples: [
								{
									word: 'homeless',
									ipa: '/hˈəʊmləs/',
									pos: 'adj.',
									translationZh: '无家可归的',
								},
								{
									word: 'hopeless',
									ipa: '/hˈəʊpləs/',
									pos: 'adj.',
									translationZh: '无望的',
								},
								{
									word: 'careless',
									ipa: '/kˈerles/',
									pos: 'adj.',
									translationZh: '粗心的',
								},
							],
						},
						{
							suffix: '-ous/-ious',
							meaning: '具有...性质的',
							examples: [
								{
									word: 'dangerous',
									ipa: '/dˈeɪndʒəəs/',
									pos: 'adj.',
									translationZh: '危险的',
								},
								{
									word: 'famous',
									ipa: '/fˈeɪməs/',
									pos: 'adj.',
									translationZh: '著名的',
								},
								{
									word: 'curious',
									ipa: '/kjˈʊriːəs/',
									pos: 'adj.',
									translationZh: '好奇的',
								},
							],
						},
						{
							suffix: '-ive',
							meaning: '有...倾向的，...的',
							examples: [
								{
									word: 'active',
									ipa: '/ˈæktɪv/',
									pos: 'adj.',
									translationZh: '活跃的',
								},
								{
									word: 'creative',
									ipa: '/kriːˈeɪtɪv/',
									pos: 'adj.',
									translationZh: '创造性的',
								},
								{
									word: 'sensitive',
									ipa: '/sˈensətɪv/',
									pos: 'adj.',
									translationZh: '敏感的',
								},
							],
						},
						{
							suffix: '-ic/-ical',
							meaning: '与...有关的',
							examples: [
								{
									word: 'economic',
									ipa: '/ˌekənˈɑːmɪk/',
									pos: 'adj.',
									translationZh: '经济的',
								},
								{
									word: 'historical',
									ipa: '/hɪstˈɔːrɪkəl/',
									pos: 'adj.',
									translationZh: '历史的',
								},
								{
									word: 'logical',
									ipa: '/lˈɑːdʒɪkəl/',
									pos: 'adj.',
									translationZh: '逻辑的',
								},
							],
						},
						{
							suffix: '-ish',
							meaning: '略带...的，像...的',
							examples: [
								{
									word: 'childish',
									ipa: '/tʃˈaɪldɪʃ/',
									pos: 'adj.',
									translationZh: '孩子气的',
								},
								{
									word: 'reddish',
									ipa: '/rˈedɪʃ/',
									pos: 'adj.',
									translationZh: '微红的',
								},
								{
									word: 'selfish',
									ipa: '/sˈelfɪʃ/',
									pos: 'adj.',
									translationZh: '自私的',
								},
							],
						},
						{
							suffix: '-y',
							meaning: '有...特征的',
							examples: [
								{
									word: 'cloudy',
									ipa: '/klˈaʊdiː/',
									pos: 'adj.',
									translationZh: '多云的',
								},
								{
									word: 'sunny',
									ipa: '/sˈʌniː/',
									pos: 'adj.',
									translationZh: '晴朗的',
								},
								{
									word: 'rainy',
									ipa: '/rˈeɪniː/',
									pos: 'adj.',
									translationZh: '下雨的',
								},
							],
						},
						{
							suffix: '-ly',
							meaning: '有...品质的',
							examples: [
								{
									word: 'friendly',
									ipa: '/frˈendliː/',
									pos: 'adv.',
									translationZh: '友好的',
								},
								{
									word: 'lovely',
									ipa: '/lˈʌvliː/',
									pos: 'adv.',
									translationZh: '可爱的',
								},
								{
									word: 'lively',
									ipa: '/lˈaɪvliː/',
									pos: 'adv.',
									translationZh: '活泼的',
								},
							],
						},
						{
							suffix: '-en',
							meaning: '由...制成的',
							examples: [
								{
									word: 'wooden',
									ipa: '/wˈʊdən/',
									pos: 'v.',
									translationZh: '木制的',
								},
								{
									word: 'golden',
									ipa: '/ɡˈəʊldən/',
									pos: 'v.',
									translationZh: '金色的',
								},
								{
									word: 'woolen',
									ipa: '/wˈʊlən/',
									pos: 'v.',
									translationZh: '羊毛的',
								},
							],
						},
						{
							suffix: '-ern',
							meaning: '方向的',
							examples: [
								{
									word: 'eastern',
									ipa: '/ˈiːstən/',
									pos: 'adj.',
									translationZh: '东方的',
								},
								{
									word: 'western',
									ipa: '/wˈestən/',
									pos: 'adj.',
									translationZh: '西方的',
								},
								{
									word: 'northern',
									ipa: '/nˈɔːrðən/',
									pos: 'adj.',
									translationZh: '北方的',
								},
							],
						},
						{
							suffix: '-ese',
							meaning: '...国的，...人的',
							examples: [
								{
									word: 'Chinese',
									ipa: '/tʃaɪnˈiːz/',
									pos: 'n.',
									translationZh: '中国的',
								},
								{
									word: 'Japanese',
									ipa: '/dʒˌæpənˈiːz/',
									pos: 'n.',
									translationZh: '日本的',
								},
								{
									word: 'Vietnamese',
									ipa: '/viːˌetnɑːmˈiːs/',
									pos: 'n.',
									translationZh: '越南的',
								},
							],
						},
						{
							suffix: '-an/-ian',
							meaning: '...的，...人的',
							examples: [
								{
									word: 'American',
									ipa: '/əmˈerɪkən/',
									pos: 'n.',
									translationZh: '美国的',
								},
								{
									word: 'Canadian',
									ipa: '/kənˈeɪdiːən/',
									pos: 'n.',
									translationZh: '加拿大的',
								},
								{
									word: 'Australian',
									ipa: '/ɔːstrˈeɪljən/',
									pos: 'n.',
									translationZh: '澳大利亚的',
								},
							],
						},
						{
							suffix: '-ant/-ent',
							meaning: '...的',
							examples: [
								{
									word: 'different',
									ipa: '/dˈɪfəənt/',
									pos: 'adj.',
									translationZh: '不同的',
								},
								{
									word: 'important',
									ipa: '/ˌɪmpˈɔːrtənt/',
									pos: 'adj.',
									translationZh: '重要的',
								},
								{
									word: 'excellent',
									ipa: '/ˈeksələnt/',
									pos: 'n./adj.',
									translationZh: '优秀的',
								},
							],
						},
						{
							suffix: '-ar',
							meaning: '...的',
							examples: [
								{
									word: 'regular',
									ipa: '/rˈeɡjələ/',
									pos: 'n.',
									translationZh: '规则的',
								},
								{
									word: 'familiar',
									ipa: '/fəmˈɪljə/',
									pos: 'n.',
									translationZh: '熟悉的',
								},
								{
									word: 'similar',
									ipa: '/sˈɪmələ/',
									pos: 'adj.',
									translationZh: '相似的',
								},
							],
						},
						{
							suffix: '-ory/-ary',
							meaning: '...的，与...有关的',
							examples: [
								{
									word: 'necessary',
									ipa: '/nˈesəsˌeriː/',
									pos: 'adj.',
									translationZh: '必要的',
								},
								{
									word: 'ordinary',
									ipa: '/ˈɔːrdənˌeriː/',
									pos: 'n.',
									translationZh: '普通的',
								},
								{
									word: 'revolutionary',
									ipa: '/rˌevəlˈuːʃənˌeriː/',
									pos: 'n.',
									translationZh: '革命的',
								},
							],
						},
						{
							suffix: '-some',
							meaning: '引起...的，有...倾向的',
							examples: [
								{
									word: 'troublesome',
									ipa: '/trˈʌbəlsəm/',
									pos: 'adj.',
									translationZh: '麻烦的',
								},
								{
									word: 'handsome',
									ipa: '/hˈænsəm/',
									pos: 'adj.',
									translationZh: '英俊的',
								},
								{
									word: 'wholesome',
									ipa: '/hˈəʊlsəm/',
									pos: 'adj.',
									translationZh: '有益健康的',
								},
							],
						},
						{
							suffix: '-like',
							meaning: '像...的',
							examples: [
								{
									word: 'childlike',
									ipa: '/tʃˈaɪldlˌaɪk/',
									pos: 'adj.',
									translationZh: '孩子般的',
								},
								{
									word: 'lifelike',
									ipa: '/lˈaɪflˌaɪk/',
									pos: 'adj.',
									translationZh: '逼真的',
								},
								{
									word: 'businesslike',
									ipa: '/bˈɪznɪslˌaɪk/',
									pos: 'adj.',
									translationZh: '公事公办的',
								},
							],
						},
						{
							suffix: '-proof',
							meaning: '防...的',
							examples: [
								{
									word: 'waterproof',
									ipa: '/wˈɔːtəprˌuːf/',
									pos: 'adj.',
									translationZh: '防水的',
								},
								{
									word: 'bulletproof',
									ipa: '/bˈʊlətprˌuːf/',
									pos: 'adj.',
									translationZh: '防弹的',
								},
								{
									word: 'fireproof',
									ipa: '/fˈaɪəprˌuːf/',
									pos: 'adj.',
									translationZh: '防火的',
								},
							],
						},
						{
							suffix: '-free',
							meaning: '无...的',
							examples: [
								{
									word: 'carefree',
									ipa: '/kˈerfrˌiː/',
									pos: 'n.',
									translationZh: '无忧无虑的',
								},
								{
									word: 'sugar-free',
									ipa: '/ʃˈʊɡə-frˈiː/',
									pos: 'n.',
									translationZh: '无糖的',
								},
								{
									word: 'tax-free',
									ipa: '/tˈæks-frˈiː/',
									pos: 'n.',
									translationZh: '免税的',
								},
							],
						},
						{
							suffix: '-worthy',
							meaning: '值得...的',
							examples: [
								{
									word: 'trustworthy',
									ipa: '/trˈʌstwˌɜːðiː/',
									pos: 'adj.',
									translationZh: '值得信赖的',
								},
								{
									word: 'newsworthy',
									ipa: '/nˈuːzwˌɜːðiː/',
									pos: 'adj.',
									translationZh: '有新闻价值的',
								},
								{
									word: 'praiseworthy',
									ipa: '/prˈeɪzwˌɜːðiː/',
									pos: 'adj.',
									translationZh: '值得称赞的',
								},
							],
						},
						{
							suffix: '-bound',
							meaning: '被束缚的，前往...的',
							examples: [
								{
									word: 'homebound',
									ipa: '/hˈəʊmbˌaʊnd/',
									pos: 'adj.',
									translationZh: '回家的',
								},
								{
									word: 'snowbound',
									ipa: '/snˈəʊbˌaʊnd/',
									pos: 'adj.',
									translationZh: '被雪困住的',
								},
								{
									word: 'westbound',
									ipa: '/wˈestbˌaʊnd/',
									pos: 'adj.',
									translationZh: '向西的',
								},
							],
						},
						{
							suffix: '-most',
							meaning: '最...的',
							examples: [
								{
									word: 'foremost',
									ipa: '/fˈɔːrmˌəʊst/',
									pos: 'adj.',
									translationZh: '最重要的',
								},
								{
									word: 'innermost',
									ipa: '/ˈɪnəmˌəʊst/',
									pos: 'adj.',
									translationZh: '最里面的',
								},
								{
									word: 'utmost',
									ipa: '/ˈʌtmˌəʊst/',
									pos: 'adj.',
									translationZh: '极度的',
								},
							],
						},
					],
				},
				{
					name: '动词后缀',
					items: [
						{
							suffix: '-ize/-ise',
							meaning: '使...化，使成为',
							examples: [
								{
									word: 'modernize',
									ipa: '/mˈɑːdənˌaɪz/',
									pos: 'v.',
									translationZh: '现代化',
								},
								{
									word: 'organize',
									ipa: '/ˈɔːrɡənˌaɪz/',
									pos: 'v.',
									translationZh: '组织',
								},
								{
									word: 'realize',
									ipa: '/rˈiːəlˌaɪz/',
									pos: 'v.',
									translationZh: '实现',
								},
							],
						},
						{
							suffix: '-ify',
							meaning: '使...化，使成为',
							examples: [
								{
									word: 'simplify',
									ipa: '/sˈɪmpləfˌaɪ/',
									pos: 'v.',
									translationZh: '简化',
								},
								{
									word: 'beautify',
									ipa: '/bjˈuːtɪfˌaɪ/',
									pos: 'v.',
									translationZh: '美化',
								},
								{
									word: 'clarify',
									ipa: '/klˈerəfˌaɪ/',
									pos: 'v.',
									translationZh: '澄清',
								},
							],
						},
						{
							suffix: '-en',
							meaning: '使...，变得...',
							examples: [
								{
									word: 'strengthen',
									ipa: '/strˈeŋθən/',
									pos: 'v.',
									translationZh: '加强',
								},
								{
									word: 'soften',
									ipa: '/sˈɑːfən/',
									pos: 'v.',
									translationZh: '软化',
								},
								{
									word: 'darken',
									ipa: '/dˈɑːrkən/',
									pos: 'v.',
									translationZh: '变暗',
								},
							],
						},
						{
							suffix: '-ate',
							meaning: '使...，做...',
							examples: [
								{
									word: 'activate',
									ipa: '/ˈæktəvˌeɪt/',
									pos: 'v.',
									translationZh: '激活',
								},
								{
									word: 'communicate',
									ipa: '/kəmjˈuːnəkˌeɪt/',
									pos: 'v.',
									translationZh: '交流',
								},
								{
									word: 'celebrate',
									ipa: '/sˈeləbrˌeɪt/',
									pos: 'v.',
									translationZh: '庆祝',
								},
							],
						},
					],
				},
				{
					name: '副词后缀',
					items: [
						{
							suffix: '-ly',
							meaning: '...地',
							examples: [
								{
									word: 'quickly',
									ipa: '/kwˈɪkliː/',
									pos: 'adv.',
									translationZh: '快速地',
								},
								{
									word: 'happily',
									ipa: '/hˈæpəliː/',
									pos: 'adv.',
									translationZh: '快乐地',
								},
								{
									word: 'carefully',
									ipa: '/kˈerfəliː/',
									pos: 'adv.',
									translationZh: '仔细地',
								},
							],
						},
						{
							suffix: '-ward/-wards',
							meaning: '向...方向',
							examples: [
								{
									word: 'forward',
									ipa: '/fˈɔːrwəd/',
									pos: 'adv.',
									translationZh: '向前',
								},
								{
									word: 'backward',
									ipa: '/bˈækwəd/',
									pos: 'adv.',
									translationZh: '向后',
								},
								{
									word: 'upwards',
									ipa: '/ˈʌpwədz/',
									pos: 'adv.',
									translationZh: '向上',
								},
							],
						},
						{
							suffix: '-wise',
							meaning: '在...方面，向...方向',
							examples: [
								{
									word: 'clockwise',
									ipa: '/klˈɑːkwˌaɪz/',
									pos: 'adv.',
									translationZh: '顺时针',
								},
								{
									word: 'otherwise',
									ipa: '/ˈʌðəwˌaɪz/',
									pos: 'adv.',
									translationZh: '否则',
								},
								{
									word: 'likewise',
									ipa: '/lˈaɪkwˌaɪz/',
									pos: 'adv.',
									translationZh: '同样地',
								},
							],
						},
					],
				},
			],
		},
		roots: {
			title: '词根 (Roots)',
			description: '词根是单词的核心部分，承载着单词的基本含义',
			categories: [
				{
					name: '拉丁词根 (Latin Roots)',
					items: [
						{
							root: 'act/ag',
							meaning: '做，行动',
							examples: [
								{
									word: 'action',
									ipa: '/ˈækʃən/',
									pos: 'n.',
									translationZh: '行动',
								},
								{
									word: 'agent',
									ipa: '/ˈeɪdʒənt/',
									pos: 'n./adj.',
									translationZh: '代理人',
								},
								{
									word: 'active',
									ipa: '/ˈæktɪv/',
									pos: 'adj.',
									translationZh: '活跃的',
								},
								{
									word: 'react',
									ipa: '/riːˈækt/',
									pos: 'n.',
									translationZh: '反应',
								},
							],
						},
						{
							root: 'am/ami',
							meaning: '爱',
							examples: [
								{
									word: 'amiable',
									ipa: '/ˈeɪmiːəbəl/',
									pos: 'adj.',
									translationZh: '友好的',
								},
								{
									word: 'amicable',
									ipa: '/ˈæmɪkəbəl/',
									pos: 'adj.',
									translationZh: '友好的',
								},
								{
									word: 'amateur',
									ipa: '/ˈæmətʃˌɜː/',
									pos: 'n.',
									translationZh: '业余爱好者',
								},
							],
						},
						{
							root: 'anim',
							meaning: '生命，精神',
							examples: [
								{
									word: 'animal',
									ipa: '/ˈænəməl/',
									pos: 'n.',
									translationZh: '动物',
								},
								{
									word: 'animate',
									ipa: '/ˈænəmət/',
									pos: 'v.',
									translationZh: '使有生气',
								},
								{
									word: 'unanimous',
									ipa: '/juːnˈænəməs/',
									pos: 'adj.',
									translationZh: '一致同意的',
								},
							],
						},
						{
							root: 'ann/enn',
							meaning: '年',
							examples: [
								{
									word: 'annual',
									ipa: '/ˈænjuːəl/',
									pos: 'n.',
									translationZh: '每年的',
								},
								{
									word: 'anniversary',
									ipa: '/ˌænəvˈɜːsəiː/',
									pos: 'n.',
									translationZh: '周年纪念日',
								},
								{
									word: 'centennial',
									ipa: '/sentˈeniːəl/',
									pos: 'n.',
									translationZh: '一百周年的',
								},
							],
						},
						{
							root: 'aqua',
							meaning: '水',
							examples: [
								{
									word: 'aquarium',
									ipa: '/əkwˈeriːəm/',
									pos: 'n.',
									translationZh: '水族馆',
								},
								{
									word: 'aquatic',
									ipa: '/əkwˈɑːtɪk/',
									pos: 'adj.',
									translationZh: '水生的',
								},
								{
									word: 'aqueduct',
									ipa: '/ˈækwədˌʌkt/',
									pos: 'n.',
									translationZh: '水道',
								},
							],
						},
						{
							root: 'aud',
							meaning: '听',
							examples: [
								{
									word: 'audio',
									ipa: '/ˈɑːdiːˌəʊ/',
									pos: 'n.',
									translationZh: '音频',
								},
								{
									word: 'audience',
									ipa: '/ˈɑːdiːəns/',
									pos: 'n.',
									translationZh: '观众',
								},
								{
									word: 'audible',
									ipa: '/ˈɑːdəbəl/',
									pos: 'adj.',
									translationZh: '听得见的',
								},
							],
						},
						{
							root: 'bell',
							meaning: '战争',
							examples: [
								{
									word: 'rebel',
									ipa: '/rˈebəl/',
									pos: 'n.',
									translationZh: '反叛',
								},
								{
									word: 'belligerent',
									ipa: '/bəlˈɪdʒəənt/',
									pos: 'adj.',
									translationZh: '好战的',
								},
								{
									word: 'antebellum',
									ipa: '/ˌæntɪbˈeləm/',
									pos: 'n.',
									translationZh: '战前的',
								},
							],
						},
						{
							root: 'bio',
							meaning: '生命',
							examples: [
								{
									word: 'biology',
									ipa: '/baɪˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '生物学',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
								{
									word: 'biodegradable',
									ipa: '/bˌaɪəʊdəɡrˈeɪdəbəl/',
									pos: 'adj.',
									translationZh: '可生物降解的',
								},
							],
						},
						{
							root: 'cap/capt/cept/ceive',
							meaning: '拿，取，抓',
							examples: [
								{
									word: 'capture',
									ipa: '/kˈæptʃə/',
									pos: 'v.',
									translationZh: '捕获',
								},
								{
									word: 'accept',
									ipa: '/æksˈept/',
									pos: 'v.',
									translationZh: '接受',
								},
								{
									word: 'receive',
									ipa: '/rəsˈiːv/',
									pos: 'v.',
									translationZh: '收到',
								},
								{
									word: 'except',
									ipa: '/ɪksˈept/',
									pos: 'n.',
									translationZh: '除外',
								},
							],
						},
						{
							root: 'ced/ceed/cess',
							meaning: '走，去',
							examples: [
								{
									word: 'proceed',
									ipa: '/prəsˈiːd/',
									pos: 'v.',
									translationZh: '继续进行',
								},
								{
									word: 'process',
									ipa: '/prˈɑːsˌes/',
									pos: 'n.',
									translationZh: '过程',
								},
								{
									word: 'success',
									ipa: '/səksˈes/',
									pos: 'n.',
									translationZh: '成功',
								},
								{
									word: 'recede',
									ipa: '/rɪsˈiːd/',
									pos: 'v.',
									translationZh: '后退',
								},
							],
						},
						{
							root: 'cent',
							meaning: '百，百分之一',
							examples: [
								{
									word: 'century',
									ipa: '/sˈentʃəiː/',
									pos: 'n.',
									translationZh: '世纪',
								},
								{
									word: 'percent',
									ipa: '/pəsˈent/',
									pos: 'n./adj.',
									translationZh: '百分比',
								},
								{
									word: 'centimeter',
									ipa: '/sˈentəmˌiːtə/',
									pos: 'n.',
									translationZh: '厘米',
								},
							],
						},
						{
							root: 'cert',
							meaning: '确定',
							examples: [
								{
									word: 'certain',
									ipa: '/sˈɜːtən/',
									pos: 'adj.',
									translationZh: '确定的',
								},
								{
									word: 'certify',
									ipa: '/sˈɜːtəfˌaɪ/',
									pos: 'adj.',
									translationZh: '证明',
								},
								{
									word: 'certificate',
									ipa: '/sətˈɪfɪkət/',
									pos: 'v.',
									translationZh: '证书',
								},
							],
						},
						{
							root: 'chron',
							meaning: '时间',
							examples: [
								{
									word: 'chronic',
									ipa: '/krˈɑːnɪk/',
									pos: 'adj.',
									translationZh: '慢性的',
								},
								{
									word: 'chronology',
									ipa: '/krənˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '年代学',
								},
								{
									word: 'synchronize',
									ipa: '/sˈɪŋkrənˌaɪz/',
									pos: 'v.',
									translationZh: '同步',
								},
							],
						},
						{
							root: 'cid/cis',
							meaning: '切，杀',
							examples: [
								{
									word: 'decide',
									ipa: '/dˌɪsˈaɪd/',
									pos: 'v.',
									translationZh: '决定',
								},
								{
									word: 'precise',
									ipa: '/prɪsˈaɪs/',
									pos: 'adj.',
									translationZh: '精确的',
								},
								{
									word: 'suicide',
									ipa: '/sˈuːəsˌaɪd/',
									pos: 'n.',
									translationZh: '自杀',
								},
								{
									word: 'insecticide',
									ipa: '/ˌɪnsˈektəsˌaɪd/',
									pos: 'n.',
									translationZh: '杀虫剂',
								},
							],
						},
						{
							root: 'circ/cycl',
							meaning: '圆，环',
							examples: [
								{
									word: 'circle',
									ipa: '/sˈɜːkəl/',
									pos: 'n.',
									translationZh: '圆',
								},
								{
									word: 'cycle',
									ipa: '/sˈaɪkəl/',
									pos: 'n.',
									translationZh: '循环',
								},
								{
									word: 'bicycle',
									ipa: '/ˈbaɪsɪkəl/',
									pos: 'n.',
									translationZh: '自行车',
								},
								{
									word: 'circulate',
									ipa: '/sˈɜːkjəlˌeɪt/',
									pos: 'v.',
									translationZh: '循环',
								},
							],
						},
						{
							root: 'claim/clam',
							meaning: '喊，叫',
							examples: [
								{
									word: 'exclaim',
									ipa: '/ɪksklˈeɪm/',
									pos: 'v.',
									translationZh: '呼喊',
								},
								{
									word: 'proclaim',
									ipa: '/prəʊklˈeɪm/',
									pos: 'v.',
									translationZh: '宣布',
								},
								{
									word: 'clamor',
									ipa: '/klˈæmə/',
									pos: 'n.',
									translationZh: '喧闹',
								},
							],
						},
						{
							root: 'clin',
							meaning: '倾斜，弯曲',
							examples: [
								{
									word: 'decline',
									ipa: '/dɪklˈaɪn/',
									pos: 'v.',
									translationZh: '下降',
								},
								{
									word: 'incline',
									ipa: '/ˌɪnklˈaɪn/',
									pos: 'v.',
									translationZh: '倾斜',
								},
								{
									word: 'recline',
									ipa: '/rɪklˈaɪn/',
									pos: 'v.',
									translationZh: '斜倚',
								},
							],
						},
						{
							root: 'clud/clus/clos',
							meaning: '关闭',
							examples: [
								{
									word: 'conclude',
									ipa: '/kənklˈuːd/',
									pos: 'v.',
									translationZh: '结束',
								},
								{
									word: 'exclude',
									ipa: '/ɪksklˈuːd/',
									pos: 'v.',
									translationZh: '排除',
								},
								{
									word: 'close',
									ipa: '/klˈəʊs/',
									pos: 'n.',
									translationZh: '关闭',
								},
								{
									word: 'enclose',
									ipa: '/ɪnklˈəʊz/',
									pos: 'n.',
									translationZh: '围住',
								},
							],
						},
						{
							root: 'cogn',
							meaning: '知道',
							examples: [
								{
									word: 'recognize',
									ipa: '/rˈekəɡnˌaɪz/',
									pos: 'v.',
									translationZh: '认出',
								},
								{
									word: 'cognitive',
									ipa: '/kˈɑːɡnɪtɪv/',
									pos: 'adj.',
									translationZh: '认知的',
								},
								{
									word: 'incognito',
									ipa: '/ˌɪnkɔːɡnˈiːtəʊ/',
									pos: 'n.',
									translationZh: '隐姓埋名的',
								},
							],
						},
						{
							root: 'cord/cor',
							meaning: '心',
							examples: [
								{
									word: 'accord',
									ipa: '/əkˈɔːrd/',
									pos: 'n.',
									translationZh: '一致',
								},
								{
									word: 'concord',
									ipa: '/kˈɑːnkˌɔːrd/',
									pos: 'n.',
									translationZh: '和谐',
								},
								{
									word: 'courage',
									ipa: '/kˈɜːɪdʒ/',
									pos: 'n.',
									translationZh: '勇气',
								},
							],
						},
						{
							root: 'corp',
							meaning: '身体',
							examples: [
								{
									word: 'corporation',
									ipa: '/kˌɔːrpəˈeɪʃən/',
									pos: 'n.',
									translationZh: '公司',
								},
								{
									word: 'corpse',
									ipa: '/kˈɔːrps/',
									pos: 'n.',
									translationZh: '尸体',
								},
								{
									word: 'incorporate',
									ipa: '/ˌɪnkˈɔːrpəˌeɪt/',
									pos: 'v.',
									translationZh: '合并',
								},
							],
						},
						{
							root: 'cred',
							meaning: '相信',
							examples: [
								{
									word: 'credit',
									ipa: '/krˈedət/',
									pos: 'n.',
									translationZh: '信用',
								},
								{
									word: 'credible',
									ipa: '/krˈedəbəl/',
									pos: 'adj.',
									translationZh: '可信的',
								},
								{
									word: 'incredible',
									ipa: '/ˌɪnkrˈedəbəl/',
									pos: 'adj.',
									translationZh: '难以置信的',
								},
							],
						},
						{
							root: 'cur/cours',
							meaning: '跑，发生',
							examples: [
								{
									word: 'current',
									ipa: '/kˈɜːənt/',
									pos: 'adj.',
									translationZh: '当前的',
								},
								{
									word: 'course',
									ipa: '/kˈɔːrs/',
									pos: 'n.',
									translationZh: '课程',
								},
								{
									word: 'occur',
									ipa: '/əkˈɜː/',
									pos: 'n.',
									translationZh: '发生',
								},
								{
									word: 'recur',
									ipa: '/rɪkˈɜː/',
									pos: 'n.',
									translationZh: '复发',
								},
							],
						},
						{
							root: 'cur/care',
							meaning: '关心，注意',
							examples: [
								{
									word: 'cure',
									ipa: '/kjˈʊr/',
									pos: 'n.',
									translationZh: '治疗',
								},
								{
									word: 'accurate',
									ipa: '/ˈækjəət/',
									pos: 'adj.',
									translationZh: '准确的',
								},
								{
									word: 'secure',
									ipa: '/sɪkjˈʊr/',
									pos: 'adj.',
									translationZh: '安全的',
								},
							],
						},
						{
							root: 'dent',
							meaning: '牙齿',
							examples: [
								{
									word: 'dentist',
									ipa: '/dˈentəst/',
									pos: 'n.',
									translationZh: '牙医',
								},
								{
									word: 'dental',
									ipa: '/dˈentəl/',
									pos: 'n.',
									translationZh: '牙齿的',
								},
								{
									word: 'indent',
									ipa: '/ˌɪndˈent/',
									pos: 'n./adj.',
									translationZh: '缩进',
								},
							],
						},
						{
							root: 'dic/dict',
							meaning: '说',
							examples: [
								{
									word: 'dictionary',
									ipa: '/dˈɪkʃənˌeriː/',
									pos: 'n.',
									translationZh: '词典',
								},
								{
									word: 'predict',
									ipa: '/prɪdˈɪkt/',
									pos: 'n.',
									translationZh: '预测',
								},
								{
									word: 'indicate',
									ipa: '/ˈɪndəkˌeɪt/',
									pos: 'v.',
									translationZh: '表明',
								},
								{
									word: 'dictate',
									ipa: '/dɪktˈeɪt/',
									pos: 'v.',
									translationZh: '口述',
								},
							],
						},
						{
							root: 'doc/duc/duct',
							meaning: '引导，带来',
							examples: [
								{
									word: 'doctor',
									ipa: '/dˈɑːktə/',
									pos: 'n.',
									translationZh: '医生',
								},
								{
									word: 'educate',
									ipa: '/ˈedʒəkˌeɪt/',
									pos: 'v.',
									translationZh: '教育',
								},
								{
									word: 'conduct',
									ipa: '/kˈɑːndəkt/',
									pos: 'v.',
									translationZh: '引导',
								},
								{
									word: 'produce',
									ipa: '/prədˈuːs/',
									pos: 'v.',
									translationZh: '生产',
								},
							],
						},
						{
							root: 'domin',
							meaning: '统治',
							examples: [
								{
									word: 'dominate',
									ipa: '/dˈɑːmənˌeɪt/',
									pos: 'v.',
									translationZh: '支配',
								},
								{
									word: 'dominion',
									ipa: '/dəmˈɪnjən/',
									pos: 'n.',
									translationZh: '统治权',
								},
								{
									word: 'predominant',
									ipa: '/prɪdˈɑːmənənt/',
									pos: 'n./adj.',
									translationZh: '占优势的',
								},
							],
						},
						{
							root: 'dorm',
							meaning: '睡眠',
							examples: [
								{
									word: 'dormitory',
									ipa: '/dˈɔːrmətˌɔːriː/',
									pos: 'n.',
									translationZh: '宿舍',
								},
								{
									word: 'dormant',
									ipa: '/dˈɔːrmənt/',
									pos: 'adj.',
									translationZh: '休眠的',
								},
							],
						},
						{
							root: 'dur',
							meaning: '持久，坚硬',
							examples: [
								{
									word: 'durable',
									ipa: '/dˈʊrəbəl/',
									pos: 'adj.',
									translationZh: '持久的',
								},
								{
									word: 'endure',
									ipa: '/endjˈʊr/',
									pos: 'v.',
									translationZh: '忍受',
								},
								{
									word: 'duration',
									ipa: '/dˈʊrˈeɪʃən/',
									pos: 'n.',
									translationZh: '持续时间',
								},
							],
						},
						{
							root: 'equ',
							meaning: '相等',
							examples: [
								{
									word: 'equal',
									ipa: '/ˈiːkwəl/',
									pos: 'adj.',
									translationZh: '相等的',
								},
								{
									word: 'equation',
									ipa: '/ɪkwˈeɪʒən/',
									pos: 'n.',
									translationZh: '方程',
								},
								{
									word: 'equator',
									ipa: '/ɪkwˈeɪtə/',
									pos: 'n.',
									translationZh: '赤道',
								},
								{
									word: 'adequate',
									ipa: '/ˈædəkwət/',
									pos: 'adj.',
									translationZh: '足够的',
								},
							],
						},
						{
							root: 'fac/fact/fect',
							meaning: '做，制作',
							examples: [
								{
									word: 'factory',
									ipa: '/fˈæktəiː/',
									pos: 'n.',
									translationZh: '工厂',
								},
								{
									word: 'perfect',
									ipa: '/pəfˈekt/',
									pos: 'adj.',
									translationZh: '完美的',
								},
								{
									word: 'affect',
									ipa: '/əfˈekt/',
									pos: 'v.',
									translationZh: '影响',
								},
								{
									word: 'effect',
									ipa: '/ɪfˈekt/',
									pos: 'n.',
									translationZh: '效果',
								},
							],
						},
						{
							root: 'fer',
							meaning: '携带，产生',
							examples: [
								{
									word: 'transfer',
									ipa: '/trænsfˈɜː/',
									pos: 'v.',
									translationZh: '转移',
								},
								{
									word: 'refer',
									ipa: '/rəfˈɜː/',
									pos: 'v.',
									translationZh: '参考',
								},
								{
									word: 'confer',
									ipa: '/kənfˈɜː/',
									pos: 'v.',
									translationZh: '商议',
								},
								{
									word: 'infer',
									ipa: '/ˌɪnfˈɜː/',
									pos: 'v.',
									translationZh: '推断',
								},
							],
						},
						{
							root: 'fid',
							meaning: '信任',
							examples: [
								{
									word: 'confidence',
									ipa: '/kˈɑːnfədens/',
									pos: 'n.',
									translationZh: '信心',
								},
								{
									word: 'fidelity',
									ipa: '/fədˈelətiː/',
									pos: 'n.',
									translationZh: '忠诚',
								},
								{
									word: 'confide',
									ipa: '/kənfˈaɪd/',
									pos: 'n.',
									translationZh: '吐露',
								},
							],
						},
						{
							root: 'fin',
							meaning: '结束，界限',
							examples: [
								{
									word: 'finish',
									ipa: '/fˈɪnɪʃ/',
									pos: 'adj.',
									translationZh: '完成',
								},
								{
									word: 'final',
									ipa: '/fˈaɪnəl/',
									pos: 'adj.',
									translationZh: '最后的',
								},
								{
									word: 'infinite',
									ipa: '/ˈɪnfənət/',
									pos: 'adj.',
									translationZh: '无限的',
								},
								{
									word: 'define',
									ipa: '/dɪfˈaɪn/',
									pos: 'v.',
									translationZh: '定义',
								},
							],
						},
						{
							root: 'firm',
							meaning: '坚固',
							examples: [
								{
									word: 'firm',
									ipa: '/fˈɜːm/',
									pos: 'adj.',
									translationZh: '坚固的',
								},
								{
									word: 'confirm',
									ipa: '/kənfˈɜːm/',
									pos: 'v.',
									translationZh: '确认',
								},
								{
									word: 'affirm',
									ipa: '/əfˈɜːm/',
									pos: 'v.',
									translationZh: '肯定',
								},
							],
						},
						{
							root: 'fix',
							meaning: '固定',
							examples: [
								{
									word: 'fix',
									ipa: '/fˈɪks/',
									pos: 'n.',
									translationZh: '固定',
								},
								{
									word: 'prefix',
									ipa: '/ˈpriːfɪks/',
									pos: 'n.',
									translationZh: '前缀',
								},
								{
									word: 'suffix',
									ipa: '/sˈʌfɪks/',
									pos: 'n.',
									translationZh: '后缀',
								},
							],
						},
						{
							root: 'flam/flagr',
							meaning: '火焰',
							examples: [
								{
									word: 'flame',
									ipa: '/flˈeɪm/',
									pos: 'n.',
									translationZh: '火焰',
								},
								{
									word: 'inflammable',
									ipa: '/ɪnflˈæməbəl/',
									pos: 'adj.',
									translationZh: '易燃的',
								},
								{
									word: 'flagrant',
									ipa: '/flˈeɪɡrənt/',
									pos: 'adj.',
									translationZh: '公然的',
								},
							],
						},
						{
							root: 'flect/flex',
							meaning: '弯曲',
							examples: [
								{
									word: 'reflect',
									ipa: '/rəflˈekt/',
									pos: 'n.',
									translationZh: '反射',
								},
								{
									word: 'flexible',
									ipa: '/flˈeksəbəl/',
									pos: 'adj.',
									translationZh: '灵活的',
								},
								{
									word: 'inflexible',
									ipa: '/ˌɪnflˈeksəbəl/',
									pos: 'adj.',
									translationZh: '不灵活的',
								},
							],
						},
						{
							root: 'flu/flux',
							meaning: '流动',
							examples: [
								{
									word: 'fluid',
									ipa: '/flˈuːəd/',
									pos: 'adj.',
									translationZh: '流体',
								},
								{
									word: 'influence',
									ipa: '/ˈɪnfluːəns/',
									pos: 'n.',
									translationZh: '影响',
								},
								{
									word: 'fluent',
									ipa: '/flˈuːənt/',
									pos: 'adj.',
									translationZh: '流利的',
								},
								{
									word: 'flux',
									ipa: '/flˈʌks/',
									pos: 'n.',
									translationZh: '流动',
								},
							],
						},
						{
							root: 'form',
							meaning: '形状，形式',
							examples: [
								{
									word: 'form',
									ipa: '/fˈɔːrm/',
									pos: 'n.',
									translationZh: '形式',
								},
								{
									word: 'transform',
									ipa: '/trænsfˈɔːrm/',
									pos: 'v.',
									translationZh: '转变',
								},
								{
									word: 'uniform',
									ipa: '/ˈjuːnɪfɔːm/',
									pos: 'n.',
									translationZh: '制服',
								},
								{
									word: 'formula',
									ipa: '/fˈɔːrmjələ/',
									pos: 'n.',
									translationZh: '公式',
								},
							],
						},
						{
							root: 'fort',
							meaning: '强壮',
							examples: [
								{
									word: 'fort',
									ipa: '/fˈɔːrt/',
									pos: 'n.',
									translationZh: '堡垒',
								},
								{
									word: 'effort',
									ipa: '/ˈefət/',
									pos: 'n.',
									translationZh: '努力',
								},
								{
									word: 'comfort',
									ipa: '/kˈʌmfət/',
									pos: 'n.',
									translationZh: '舒适',
								},
								{
									word: 'fortify',
									ipa: '/fˈɔːrtɪfˌaɪ/',
									pos: 'adj.',
									translationZh: '加强',
								},
							],
						},
						{
							root: 'frag/fract',
							meaning: '打破',
							examples: [
								{
									word: 'fragment',
									ipa: '/frˈæɡmənt/',
									pos: 'n.',
									translationZh: '碎片',
								},
								{
									word: 'fracture',
									ipa: '/frˈæktʃə/',
									pos: 'n.',
									translationZh: '骨折',
								},
								{
									word: 'fragile',
									ipa: '/frˈædʒəl/',
									pos: 'adj.',
									translationZh: '易碎的',
								},
								{
									word: 'fraction',
									ipa: '/frˈækʃən/',
									pos: 'n.',
									translationZh: '分数',
								},
							],
						},
						{
							root: 'fus',
							meaning: '倾倒，融合',
							examples: [
								{
									word: 'confuse',
									ipa: '/kənfjˈuːz/',
									pos: 'n.',
									translationZh: '混淆',
								},
								{
									word: 'refuse',
									ipa: '/rəfjˈuːz/',
									pos: 'n.',
									translationZh: '拒绝',
								},
								{
									word: 'fusion',
									ipa: '/fjˈuːʒən/',
									pos: 'n.',
									translationZh: '融合',
								},
								{
									word: 'infuse',
									ipa: '/ˌɪnfjˈuːz/',
									pos: 'n.',
									translationZh: '注入',
								},
							],
						},
						{
							root: 'gen/gener',
							meaning: '出生，产生',
							examples: [
								{
									word: 'generate',
									ipa: '/dʒˈenəˌeɪt/',
									pos: 'v.',
									translationZh: '产生',
								},
								{
									word: 'general',
									ipa: '/dʒˈenəəl/',
									pos: 'adj.',
									translationZh: '一般的',
								},
								{
									word: 'origin',
									ipa: '/ˈɔːrədʒən/',
									pos: 'n.',
									translationZh: '起源',
								},
								{
									word: 'pregnant',
									ipa: '/prˈeɡnənt/',
									pos: 'adj.',
									translationZh: '怀孕的',
								},
							],
						},
						{
							root: 'grad/gress',
							meaning: '步，走',
							examples: [
								{
									word: 'progress',
									ipa: '/prˈɑːɡrˌes/',
									pos: 'v.',
									translationZh: '进步',
								},
								{
									word: 'graduate',
									ipa: '/ɡrˈædʒəwət/',
									pos: 'v.',
									translationZh: '毕业',
								},
								{
									word: 'grade',
									ipa: '/ɡrˈeɪd/',
									pos: 'n.',
									translationZh: '等级',
								},
								{
									word: 'aggressive',
									ipa: '/əɡrˈesɪv/',
									pos: 'adj.',
									translationZh: '侵略性的',
								},
							],
						},
						{
							root: 'gram/graph',
							meaning: '写，画，记录',
							examples: [
								{
									word: 'grammar',
									ipa: '/ɡrˈæmə/',
									pos: 'n.',
									translationZh: '语法',
								},
								{
									word: 'telegram',
									ipa: '/tˈeləɡrˌæm/',
									pos: 'n.',
									translationZh: '电报',
								},
								{
									word: 'photograph',
									ipa: '/fˈəʊtəɡrˌæf/',
									pos: 'n.',
									translationZh: '照片',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
							],
						},
						{
							root: 'grat',
							meaning: '感激，高兴',
							examples: [
								{
									word: 'grateful',
									ipa: '/ɡrˈeɪtfəl/',
									pos: 'adj.',
									translationZh: '感激的',
								},
								{
									word: 'gratitude',
									ipa: '/ɡrˈætətˌuːd/',
									pos: 'n.',
									translationZh: '感激',
								},
								{
									word: 'congratulate',
									ipa: '/kənɡrˈætʃəlˌeɪt/',
									pos: 'v.',
									translationZh: '祝贺',
								},
							],
						},
						{
							root: 'grav',
							meaning: '重',
							examples: [
								{
									word: 'gravity',
									ipa: '/ɡrˈævətiː/',
									pos: 'n.',
									translationZh: '重力',
								},
								{
									word: 'grave',
									ipa: '/ɡrˈeɪv/',
									pos: 'adj.',
									translationZh: '严重的',
								},
								{
									word: 'aggravate',
									ipa: '/ˈæɡrəvˌeɪt/',
									pos: 'v.',
									translationZh: '加重',
								},
							],
						},
						{
							root: 'greg',
							meaning: '群，集合',
							examples: [
								{
									word: 'group',
									ipa: '/ɡrˈuːp/',
									pos: 'n.',
									translationZh: '群体',
								},
								{
									word: 'aggregate',
									ipa: '/ˈæɡrəɡət/',
									pos: 'v.',
									translationZh: '合计',
								},
								{
									word: 'segregate',
									ipa: '/sˈeɡrəɡˌeɪt/',
									pos: 'v.',
									translationZh: '隔离',
								},
							],
						},
						{
							root: 'habit/hibit',
							meaning: '持有，居住',
							examples: [
								{
									word: 'habit',
									ipa: '/hˈæbət/',
									pos: 'n.',
									translationZh: '习惯',
								},
								{
									word: 'inhabit',
									ipa: '/ˌɪnhˈæbət/',
									pos: 'v.',
									translationZh: '居住',
								},
								{
									word: 'exhibit',
									ipa: '/ɪɡzˈɪbɪt/',
									pos: 'v.',
									translationZh: '展览',
								},
								{
									word: 'prohibit',
									ipa: '/prəʊhˈɪbət/',
									pos: 'v.',
									translationZh: '禁止',
								},
							],
						},
						{
							root: 'her/hes',
							meaning: '粘附',
							examples: [
								{
									word: 'adhere',
									ipa: '/ədhˈɪr/',
									pos: 'v.',
									translationZh: '坚持',
								},
								{
									word: 'coherent',
									ipa: '/kəʊhˈɪrənt/',
									pos: 'adj.',
									translationZh: '连贯的',
								},
								{
									word: 'inherent',
									ipa: '/ˌɪnhˈerənt/',
									pos: 'adj.',
									translationZh: '固有的',
								},
							],
						},
						{
							root: 'hum',
							meaning: '土，人，湿',
							examples: [
								{
									word: 'human',
									ipa: '/hjˈuːmən/',
									pos: 'n.',
									translationZh: '人类',
								},
								{
									word: 'humid',
									ipa: '/hjˈuːməd/',
									pos: 'adj.',
									translationZh: '潮湿的',
								},
								{
									word: 'humble',
									ipa: '/hˈʌmbəl/',
									pos: 'adj.',
									translationZh: '谦卑的',
								},
							],
						},
						{
							root: 'hydr',
							meaning: '水',
							examples: [
								{
									word: 'hydrogen',
									ipa: '/hˈaɪdrədʒən/',
									pos: 'n.',
									translationZh: '氢',
								},
								{
									word: 'hydrant',
									ipa: '/hˈaɪdrənt/',
									pos: 'n.',
									translationZh: '消防栓',
								},
								{
									word: 'dehydrate',
									ipa: '/dɪhˈaɪdreɪt/',
									pos: 'v.',
									translationZh: '脱水',
								},
							],
						},
						{
							root: 'ject',
							meaning: '投掷，扔',
							examples: [
								{
									word: 'project',
									ipa: '/prˈɑːdʒekt/',
									pos: 'n.',
									translationZh: '项目',
								},
								{
									word: 'reject',
									ipa: '/rɪdʒˈekt/',
									pos: 'n.',
									translationZh: '拒绝',
								},
								{
									word: 'inject',
									ipa: '/ˌɪndʒˈekt/',
									pos: 'v.',
									translationZh: '注射',
								},
								{
									word: 'subject',
									ipa: '/səbdʒˈekt/',
									pos: 'n.',
									translationZh: '主题',
								},
							],
						},
						{
							root: 'join/junct',
							meaning: '连接',
							examples: [
								{
									word: 'join',
									ipa: '/dʒˈɔɪn/',
									pos: 'n.',
									translationZh: '连接',
								},
								{
									word: 'junction',
									ipa: '/dʒˈʌŋkʃən/',
									pos: 'n.',
									translationZh: '连接点',
								},
								{
									word: 'conjunction',
									ipa: '/kəndʒˈʌŋkʃən/',
									pos: 'n.',
									translationZh: '连词',
								},
								{
									word: 'adjunct',
									ipa: '/ˈædʒˌʌŋkt/',
									pos: 'n.',
									translationZh: '附属物',
								},
							],
						},
						{
							root: 'jud/jur/jus',
							meaning: '法律，正义',
							examples: [
								{
									word: 'judge',
									ipa: '/dʒˈʌdʒ/',
									pos: 'n.',
									translationZh: '法官',
								},
								{
									word: 'jury',
									ipa: '/dʒˈʊriː/',
									pos: 'n.',
									translationZh: '陪审团',
								},
								{
									word: 'justice',
									ipa: '/dʒˈʌstəs/',
									pos: 'n.',
									translationZh: '正义',
								},
								{
									word: 'injury',
									ipa: '/ˈɪndʒəiː/',
									pos: 'n.',
									translationZh: '伤害',
								},
							],
						},
						{
							root: 'labor',
							meaning: '工作',
							examples: [
								{
									word: 'labor',
									ipa: '/lˈeɪbə/',
									pos: 'n.',
									translationZh: '劳动',
								},
								{
									word: 'collaborate',
									ipa: '/kəlˈæbəˌeɪt/',
									pos: 'v.',
									translationZh: '合作',
								},
								{
									word: 'elaborate',
									ipa: '/ɪlˈæbrət/',
									pos: 'v.',
									translationZh: '精心制作的',
								},
							],
						},
						{
							root: 'lect/leg/lex',
							meaning: '读，说，选择',
							examples: [
								{
									word: 'lecture',
									ipa: '/lˈektʃə/',
									pos: 'n.',
									translationZh: '讲座',
								},
								{
									word: 'legend',
									ipa: '/lˈedʒənd/',
									pos: 'n.',
									translationZh: '传说',
								},
								{
									word: 'select',
									ipa: '/səlˈekt/',
									pos: 'n.',
									translationZh: '选择',
								},
								{
									word: 'intellect',
									ipa: '/ˈɪntəlˌekt/',
									pos: 'n.',
									translationZh: '智力',
								},
							],
						},
						{
							root: 'leg',
							meaning: '法律',
							examples: [
								{
									word: 'legal',
									ipa: '/lˈiːɡəl/',
									pos: 'n.',
									translationZh: '合法的',
								},
								{
									word: 'legislate',
									ipa: '/lˈedʒɪslˌeɪt/',
									pos: 'v.',
									translationZh: '立法',
								},
								{
									word: 'privilege',
									ipa: '/prˈɪvɪlɪdʒ/',
									pos: 'n.',
									translationZh: '特权',
								},
							],
						},
						{
							root: 'lev',
							meaning: '轻，举起',
							examples: [
								{
									word: 'levitate',
									ipa: '/lˈevɪtˌeɪt/',
									pos: 'v.',
									translationZh: '漂浮',
								},
								{
									word: 'elevator',
									ipa: '/ˈeləvˌeɪtə/',
									pos: 'n.',
									translationZh: '电梯',
								},
								{
									word: 'relieve',
									ipa: '/rɪlˈiːv/',
									pos: 'v.',
									translationZh: '减轻',
								},
								{
									word: 'lever',
									ipa: '/lˈevə/',
									pos: 'n.',
									translationZh: '杠杆',
								},
							],
						},
						{
							root: 'liber',
							meaning: '自由',
							examples: [
								{
									word: 'liberty',
									ipa: '/lˈɪbətˌiː/',
									pos: 'n.',
									translationZh: '自由',
								},
								{
									word: 'liberal',
									ipa: '/lˈɪbˌɜːəl/',
									pos: 'n.',
									translationZh: '自由的',
								},
								{
									word: 'liberate',
									ipa: '/lˈɪbˌɜːˌeɪt/',
									pos: 'v.',
									translationZh: '解放',
								},
							],
						},
						{
							root: 'lingu',
							meaning: '语言',
							examples: [
								{
									word: 'linguist',
									ipa: '/lˈɪŋɡwɪst/',
									pos: 'n.',
									translationZh: '语言学家',
								},
								{
									word: 'bilingual',
									ipa: '/baɪˈlɪŋɡwəl/',
									pos: 'adj.',
									translationZh: '双语的',
								},
								{
									word: 'multilingual',
									ipa: '/mˌʌltiːlˈɪŋwəl/',
									pos: 'adj.',
									translationZh: '多语的',
								},
							],
						},
						{
							root: 'liter',
							meaning: '字母，文字',
							examples: [
								{
									word: 'literature',
									ipa: '/lˈɪtəətʃə/',
									pos: 'n.',
									translationZh: '文学',
								},
								{
									word: 'literal',
									ipa: '/lˈɪtəəl/',
									pos: 'adj.',
									translationZh: '字面的',
								},
								{
									word: 'illiterate',
									ipa: '/ɪˈlɪtərət/',
									pos: 'adj.',
									translationZh: '文盲的',
								},
							],
						},
						{
							root: 'loc',
							meaning: '地方',
							examples: [
								{
									word: 'local',
									ipa: '/lˈəʊkəl/',
									pos: 'adj.',
									translationZh: '当地的',
								},
								{
									word: 'locate',
									ipa: '/lˈəʊkˌeɪt/',
									pos: 'v.',
									translationZh: '定位',
								},
								{
									word: 'allocate',
									ipa: '/ˈæləkˌeɪt/',
									pos: 'v.',
									translationZh: '分配',
								},
							],
						},
						{
							root: 'log/logue',
							meaning: '说话，推理',
							examples: [
								{
									word: 'dialogue',
									ipa: '/dˈaɪəlˌɔːɡ/',
									pos: 'n.',
									translationZh: '对话',
								},
								{
									word: 'logic',
									ipa: '/lˈɑːdʒɪk/',
									pos: 'n.',
									translationZh: '逻辑',
								},
								{
									word: 'apologize',
									ipa: '/əpˈɑːlədʒˌaɪz/',
									pos: 'v.',
									translationZh: '道歉',
								},
								{
									word: 'monologue',
									ipa: '/ˈmɒnəlɒɡ/',
									pos: 'n.',
									translationZh: '独白',
								},
							],
						},
						{
							root: 'loqu/locut',
							meaning: '说',
							examples: [
								{
									word: 'eloquent',
									ipa: '/ˈeləkwənt/',
									pos: 'adj.',
									translationZh: '雄辩的',
								},
								{
									word: 'colloquial',
									ipa: '/kəlˈəʊkwiːəl/',
									pos: 'n.',
									translationZh: '口语的',
								},
								{
									word: 'circumlocution',
									ipa: '/ˌsɜːkəmləˈkjuːʃən/',
									pos: 'n.',
									translationZh: '迂回说法',
								},
							],
						},
						{
							root: 'luc/lum/lus',
							meaning: '光',
							examples: [
								{
									word: 'lucid',
									ipa: '/lˈuːsɪd/',
									pos: 'adj.',
									translationZh: '清晰的',
								},
								{
									word: 'illuminate',
									ipa: '/ˌɪlˈuːmɪnɪt/',
									pos: 'v.',
									translationZh: '照亮',
								},
								{
									word: 'illustrate',
									ipa: '/ˈɪləstrˌeɪt/',
									pos: 'v.',
									translationZh: '说明',
								},
							],
						},
						{
							root: 'man/manu',
							meaning: '手',
							examples: [
								{
									word: 'manual',
									ipa: '/mˈænjuːəl/',
									pos: 'n.',
									translationZh: '手工的',
								},
								{
									word: 'manufacture',
									ipa: '/mˌænjəfˈæktʃə/',
									pos: 'v.',
									translationZh: '制造',
								},
								{
									word: 'manuscript',
									ipa: '/mˈænjəskrˌɪpt/',
									pos: 'n.',
									translationZh: '手稿',
								},
								{
									word: 'manipulate',
									ipa: '/mənˈɪpjəlˌeɪt/',
									pos: 'v.',
									translationZh: '操纵',
								},
							],
						},
						{
							root: 'mar',
							meaning: '海',
							examples: [
								{
									word: 'marine',
									ipa: '/məˈiːn/',
									pos: 'n.',
									translationZh: '海洋的',
								},
								{
									word: 'submarine',
									ipa: '/ˌsʌbməˈriːn/',
									pos: 'n.',
									translationZh: '潜艇',
								},
								{
									word: 'maritime',
									ipa: '/mˈærətˌaɪm/',
									pos: 'n.',
									translationZh: '海事的',
								},
							],
						},
						{
							root: 'medi',
							meaning: '中间',
							examples: [
								{
									word: 'medium',
									ipa: '/mˈiːdiːəm/',
									pos: 'n.',
									translationZh: '媒介',
								},
								{
									word: 'mediate',
									ipa: '/mˈiːdiːˌeɪt/',
									pos: 'v.',
									translationZh: '调解',
								},
								{
									word: 'immediate',
									ipa: '/ˌɪmˈiːdˌiːət/',
									pos: 'v.',
									translationZh: '立即的',
								},
								{
									word: 'medieval',
									ipa: '/mɪdˈiːvəl/',
									pos: 'n.',
									translationZh: '中世纪的',
								},
							],
						},
						{
							root: 'memor',
							meaning: '记忆',
							examples: [
								{
									word: 'memory',
									ipa: '/mˈeməiː/',
									pos: 'n.',
									translationZh: '记忆',
								},
								{
									word: 'memorial',
									ipa: '/məmˈɔːriːəl/',
									pos: 'n.',
									translationZh: '纪念的',
								},
								{
									word: 'commemorate',
									ipa: '/kəmˈeməˌeɪt/',
									pos: 'v.',
									translationZh: '纪念',
								},
								{
									word: 'remember',
									ipa: '/rɪmˈembə/',
									pos: 'v.',
									translationZh: '记得',
								},
							],
						},
						{
							root: 'ment',
							meaning: '心智',
							examples: [
								{
									word: 'mental',
									ipa: '/mˈentəl/',
									pos: 'n.',
									translationZh: '精神的',
								},
								{
									word: 'mention',
									ipa: '/mˈenʃən/',
									pos: 'n.',
									translationZh: '提及',
								},
								{
									word: 'comment',
									ipa: '/kˈɑːment/',
									pos: 'n.',
									translationZh: '评论',
								},
							],
						},
						{
							root: 'merg/mers',
							meaning: '沉没，浸入',
							examples: [
								{
									word: 'emerge',
									ipa: '/ɪmˈɜːdʒ/',
									pos: 'n.',
									translationZh: '出现',
								},
								{
									word: 'submerge',
									ipa: '/səbmˈɜːdʒ/',
									pos: 'n.',
									translationZh: '淹没',
								},
								{
									word: 'immerse',
									ipa: '/ˌɪmˈɜːs/',
									pos: 'n.',
									translationZh: '沉浸',
								},
							],
						},
						{
							root: 'meter/metr',
							meaning: '测量',
							examples: [
								{
									word: 'thermometer',
									ipa: '/θəmˈɑːmətə/',
									pos: 'n.',
									translationZh: '温度计',
								},
								{
									word: 'geometry',
									ipa: '/dʒiːˈɑːmətriː/',
									pos: 'n.',
									translationZh: '几何',
								},
								{
									word: 'symmetry',
									ipa: '/sˈɪmətriː/',
									pos: 'n.',
									translationZh: '对称',
								},
							],
						},
						{
							root: 'migr',
							meaning: '迁移',
							examples: [
								{
									word: 'migrate',
									ipa: '/mˈaɪɡrˌeɪt/',
									pos: 'v.',
									translationZh: '迁移',
								},
								{
									word: 'immigrant',
									ipa: '/ˈɪməɡrənt/',
									pos: 'n./adj.',
									translationZh: '移民',
								},
								{
									word: 'emigrate',
									ipa: '/ˈeməɡrˌeɪt/',
									pos: 'v.',
									translationZh: '移居国外',
								},
							],
						},
						{
							root: 'min',
							meaning: '小，突出',
							examples: [
								{
									word: 'minute',
									ipa: '/mˈɪnət/',
									pos: 'n.',
									translationZh: '分钟，微小的',
								},
								{
									word: 'minimum',
									ipa: '/ˈmɪnɪməm/',
									pos: 'n.',
									translationZh: '最小值',
								},
								{
									word: 'prominent',
									ipa: '/prˈɑːmənənt/',
									pos: 'adj.',
									translationZh: '突出的',
								},
							],
						},
						{
							root: 'mir',
							meaning: '惊奇，看',
							examples: [
								{
									word: 'admire',
									ipa: '/ædmˈaɪr/',
									pos: 'n.',
									translationZh: '钦佩',
								},
								{
									word: 'miracle',
									ipa: '/mˈɪrəkəl/',
									pos: 'n.',
									translationZh: '奇迹',
								},
								{
									word: 'mirror',
									ipa: '/mˈɪrə/',
									pos: 'n.',
									translationZh: '镜子',
								},
							],
						},
						{
							root: 'miss/mit',
							meaning: '送，发',
							examples: [
								{
									word: 'mission',
									ipa: '/mˈɪʃən/',
									pos: 'n.',
									translationZh: '使命',
								},
								{
									word: 'emit',
									ipa: '/ɪmˈɪt/',
									pos: 'v.',
									translationZh: '发出',
								},
								{
									word: 'transmit',
									ipa: '/trænzmˈɪt/',
									pos: 'v.',
									translationZh: '传输',
								},
								{
									word: 'submit',
									ipa: '/səbmˈɪt/',
									pos: 'v.',
									translationZh: '提交',
								},
							],
						},
						{
							root: 'mob/mot/mov',
							meaning: '移动',
							examples: [
								{
									word: 'mobile',
									ipa: '/mˈəʊbəl/',
									pos: 'adj.',
									translationZh: '移动的',
								},
								{
									word: 'motion',
									ipa: '/mˈəʊʃən/',
									pos: 'n.',
									translationZh: '运动',
								},
								{
									word: 'move',
									ipa: '/mˈuːv/',
									pos: 'v.',
									translationZh: '移动',
								},
								{
									word: 'remote',
									ipa: '/rɪmˈəʊt/',
									pos: 'n.',
									translationZh: '遥远的',
								},
							],
						},
						{
							root: 'mod',
							meaning: '方式，适度',
							examples: [
								{
									word: 'mode',
									ipa: '/mˈəʊd/',
									pos: 'n.',
									translationZh: '模式',
								},
								{
									word: 'model',
									ipa: '/mˈɑːdəl/',
									pos: 'n.',
									translationZh: '模型',
								},
								{
									word: 'moderate',
									ipa: '/mˈɑːdəət/',
									pos: 'v.',
									translationZh: '适度的',
								},
								{
									word: 'modify',
									ipa: '/mˈɑːdəfˌaɪ/',
									pos: 'v.',
									translationZh: '修改',
								},
							],
						},
						{
							root: 'mon',
							meaning: '警告，提醒',
							examples: [
								{
									word: 'monitor',
									ipa: '/mˈɑːnətə/',
									pos: 'n.',
									translationZh: '监视器',
								},
								{
									word: 'admonish',
									ipa: '/ædmˈɑːnɪʃ/',
									pos: 'adj.',
									translationZh: '告诫',
								},
								{
									word: 'monument',
									ipa: '/mˈɑːnjuːmənt/',
									pos: 'n.',
									translationZh: '纪念碑',
								},
							],
						},
						{
							root: 'morph',
							meaning: '形状',
							examples: [
								{
									word: 'morphology',
									ipa: '/mɔːrfˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '形态学',
								},
								{
									word: 'metamorphosis',
									ipa: '/mˌetəmˈɔːrfəsəs/',
									pos: 'n.',
									translationZh: '变形',
								},
								{
									word: 'amorphous',
									ipa: '/əmˈɔːrfəs/',
									pos: 'adj.',
									translationZh: '无定形的',
								},
							],
						},
						{
							root: 'mort',
							meaning: '死',
							examples: [
								{
									word: 'mortal',
									ipa: '/mˈɔːrtəl/',
									pos: 'n.',
									translationZh: '终有一死的',
								},
								{
									word: 'immortal',
									ipa: '/ˌɪmˈɔːrtəl/',
									pos: 'n.',
									translationZh: '不朽的',
								},
								{
									word: 'mortuary',
									ipa: '/mˈɔːrtʃuːˌeriː/',
									pos: 'n.',
									translationZh: '太平间',
								},
							],
						},
						{
							root: 'mount',
							meaning: '山',
							examples: [
								{
									word: 'mountain',
									ipa: '/mˈaʊntən/',
									pos: 'n.',
									translationZh: '山',
								},
								{
									word: 'mount',
									ipa: '/mˈaʊnt/',
									pos: 'n.',
									translationZh: '登上',
								},
								{
									word: 'amount',
									ipa: '/əmˈaʊnt/',
									pos: 'n.',
									translationZh: '数量',
								},
							],
						},
						{
							root: 'mut',
							meaning: '变化',
							examples: [
								{
									word: 'mutual',
									ipa: '/mjˈuːtʃuːəl/',
									pos: 'n.',
									translationZh: '相互的',
								},
								{
									word: 'commute',
									ipa: '/kəmjˈuːt/',
									pos: 'n.',
									translationZh: '通勤',
								},
								{
									word: 'mutation',
									ipa: '/mjuːtˈeɪʃən/',
									pos: 'n.',
									translationZh: '突变',
								},
							],
						},
						{
							root: 'nat',
							meaning: '出生',
							examples: [
								{
									word: 'nation',
									ipa: '/nˈeɪʃən/',
									pos: 'n.',
									translationZh: '国家',
								},
								{
									word: 'native',
									ipa: '/nˈeɪtɪv/',
									pos: 'adj.',
									translationZh: '本地的',
								},
								{
									word: 'nature',
									ipa: '/nˈeɪtʃə/',
									pos: 'n.',
									translationZh: '自然',
								},
								{
									word: 'neonate',
									ipa: '/ˈniːəneɪt/',
									pos: 'v.',
									translationZh: '新生儿',
								},
							],
						},
						{
							root: 'nav/naut',
							meaning: '船，海员',
							examples: [
								{
									word: 'navy',
									ipa: '/nˈeɪviː/',
									pos: 'n.',
									translationZh: '海军',
								},
								{
									word: 'navigate',
									ipa: '/nˈævəɡˌeɪt/',
									pos: 'v.',
									translationZh: '航行',
								},
								{
									word: 'astronaut',
									ipa: '/ˈæstrənˌɑːt/',
									pos: 'n.',
									translationZh: '宇航员',
								},
								{
									word: 'nautical',
									ipa: '/nˈɔːtəkəl/',
									pos: 'adj.',
									translationZh: '航海的',
								},
							],
						},
						{
							root: 'nect/nex',
							meaning: '连接',
							examples: [
								{
									word: 'connect',
									ipa: '/kənˈekt/',
									pos: 'v.',
									translationZh: '连接',
								},
								{
									word: 'annex',
									ipa: '/ˈænˌeks/',
									pos: 'n.',
									translationZh: '合并',
								},
								{
									word: 'nexus',
									ipa: '/nˈeksəs/',
									pos: 'n.',
									translationZh: '连接',
								},
							],
						},
						{
							root: 'neg',
							meaning: '否认',
							examples: [
								{
									word: 'negate',
									ipa: '/nɪɡˈeɪt/',
									pos: 'v.',
									translationZh: '否定',
								},
								{
									word: 'negative',
									ipa: '/nˈeɡətɪv/',
									pos: 'adj.',
									translationZh: '否定的',
								},
								{
									word: 'neglect',
									ipa: '/nəɡlˈekt/',
									pos: 'v.',
									translationZh: '忽视',
								},
							],
						},
						{
							root: 'noc/nox',
							meaning: '伤害',
							examples: [
								{
									word: 'innocent',
									ipa: '/ˈɪnəsənt/',
									pos: 'adj.',
									translationZh: '无辜的',
								},
								{
									word: 'noxious',
									ipa: '/nˈɑːkʃəs/',
									pos: 'adj.',
									translationZh: '有害的',
								},
								{
									word: 'obnoxious',
									ipa: '/ɑːbnˈɑːkʃəs/',
									pos: 'adj.',
									translationZh: '令人讨厌的',
								},
							],
						},
						{
							root: 'nom/nym/onym',
							meaning: '名字',
							examples: [
								{
									word: 'name',
									ipa: '/nˈeɪm/',
									pos: 'n.',
									translationZh: '名字',
								},
								{
									word: 'nominate',
									ipa: '/nˈɑːmənət/',
									pos: 'v.',
									translationZh: '提名',
								},
								{
									word: 'synonym',
									ipa: '/sˈɪnənˌɪm/',
									pos: 'n.',
									translationZh: '同义词',
								},
								{
									word: 'anonymous',
									ipa: '/ənˈɑːnəməs/',
									pos: 'adj.',
									translationZh: '匿名的',
								},
							],
						},
						{
							root: 'norm',
							meaning: '规则，标准',
							examples: [
								{
									word: 'normal',
									ipa: '/nˈɔːrməl/',
									pos: 'n.',
									translationZh: '正常的',
								},
								{
									word: 'enormous',
									ipa: '/ɪnˈɔːrməs/',
									pos: 'adj.',
									translationZh: '巨大的',
								},
								{
									word: 'abnormal',
									ipa: '/æbnˈɔːrməl/',
									pos: 'adj.',
									translationZh: '异常的',
								},
							],
						},
						{
							root: 'not',
							meaning: '知道，标记',
							examples: [
								{
									word: 'note',
									ipa: '/nˈəʊt/',
									pos: 'n.',
									translationZh: '笔记',
								},
								{
									word: 'notice',
									ipa: '/nˈəʊtəs/',
									pos: 'n.',
									translationZh: '注意',
								},
								{
									word: 'notion',
									ipa: '/nˈəʊʃən/',
									pos: 'n.',
									translationZh: '概念',
								},
								{
									word: 'denote',
									ipa: '/dɪnˈəʊt/',
									pos: 'n.',
									translationZh: '表示',
								},
							],
						},
						{
							root: 'nov',
							meaning: '新',
							examples: [
								{
									word: 'novel',
									ipa: '/nˈɑːvəl/',
									pos: 'n.',
									translationZh: '小说，新颖的',
								},
								{
									word: 'innovation',
									ipa: '/ˌɪnəvˈeɪʃən/',
									pos: 'n.',
									translationZh: '创新',
								},
								{
									word: 'renovate',
									ipa: '/rˈenəvˌeɪt/',
									pos: 'v.',
									translationZh: '翻新',
								},
							],
						},
						{
							root: 'numer',
							meaning: '数字',
							examples: [
								{
									word: 'number',
									ipa: '/nˈʌmbə/',
									pos: 'n.',
									translationZh: '数字',
								},
								{
									word: 'numerous',
									ipa: '/nˈuːməəs/',
									pos: 'adj.',
									translationZh: '众多的',
								},
								{
									word: 'numerical',
									ipa: '/nuːmˈerəkəl/',
									pos: 'adj.',
									translationZh: '数字的',
								},
							],
						},
						{
							root: 'oper',
							meaning: '工作',
							examples: [
								{
									word: 'operate',
									ipa: '/ˈɑːpəˌeɪt/',
									pos: 'v.',
									translationZh: '操作',
								},
								{
									word: 'cooperate',
									ipa: '/kəʊˈɑːpəˌeɪt/',
									pos: 'v.',
									translationZh: '合作',
								},
								{
									word: 'opera',
									ipa: '/ˈɑːprə/',
									pos: 'n.',
									translationZh: '歌剧',
								},
							],
						},
						{
							root: 'opt',
							meaning: '选择',
							examples: [
								{
									word: 'option',
									ipa: '/ˈɑːpʃən/',
									pos: 'n.',
									translationZh: '选择',
								},
								{
									word: 'adopt',
									ipa: '/ədˈɑːpt/',
									pos: 'n.',
									translationZh: '采纳',
								},
								{
									word: 'optimum',
									ipa: '/ˈɑːptɪməm/',
									pos: 'n.',
									translationZh: '最佳的',
								},
							],
						},
						{
							root: 'ora/ori',
							meaning: '口，说',
							examples: [
								{
									word: 'oral',
									ipa: '/ˈɔːrəl/',
									pos: 'n.',
									translationZh: '口头的',
								},
								{
									word: 'oracle',
									ipa: '/ˈɒrəkl/',
									pos: 'n.',
									translationZh: '神谕',
								},
								{
									word: 'orate',
									ipa: '/ɔːˈreɪt/',
									pos: 'v.',
									translationZh: '演讲',
								},
							],
						},
						{
							root: 'ord',
							meaning: '顺序',
							examples: [
								{
									word: 'order',
									ipa: '/ˈɔːrdə/',
									pos: 'n.',
									translationZh: '顺序',
								},
								{
									word: 'ordinary',
									ipa: '/ˈɔːrdənˌeriː/',
									pos: 'n.',
									translationZh: '普通的',
								},
								{
									word: 'coordinate',
									ipa: '/kəʊˈɔːrdənət/',
									pos: 'v.',
									translationZh: '协调',
								},
							],
						},
						{
							root: 'ori/orig',
							meaning: '升起，开始',
							examples: [
								{
									word: 'origin',
									ipa: '/ˈɔːrədʒən/',
									pos: 'n.',
									translationZh: '起源',
								},
								{
									word: 'orient',
									ipa: '/ˈɔːriːˌent/',
									pos: 'v.',
									translationZh: '东方',
								},
								{
									word: 'abort',
									ipa: '/əbˈɔːrt/',
									pos: 'v.',
									translationZh: '中止',
								},
							],
						},
						{
							root: 'par',
							meaning: '相等，准备',
							examples: [
								{
									word: 'equal',
									ipa: '/ˈiːkwəl/',
									pos: 'adj.',
									translationZh: '相等的',
								},
								{
									word: 'prepare',
									ipa: '/prɪˈpeə/',
									pos: 'v.',
									translationZh: '准备',
								},
								{
									word: 'separate',
									ipa: '/sˈepəˌeɪt/',
									pos: 'v.',
									translationZh: '分离',
								},
								{
									word: 'apparatus',
									ipa: '/ˌæpəˈætəs/',
									pos: 'n.',
									translationZh: '仪器',
								},
							],
						},
						{
							root: 'part',
							meaning: '部分',
							examples: [
								{
									word: 'part',
									ipa: '/pˈɑːrt/',
									pos: 'n.',
									translationZh: '部分',
								},
								{
									word: 'particle',
									ipa: '/pˈɑːrtəkəl/',
									pos: 'n.',
									translationZh: '粒子',
								},
								{
									word: 'partial',
									ipa: '/pˈɑːrʃəl/',
									pos: 'adj.',
									translationZh: '部分的',
								},
								{
									word: 'participate',
									ipa: '/pɑːrtˈɪsəpˌeɪt/',
									pos: 'v.',
									translationZh: '参与',
								},
							],
						},
						{
							root: 'pass/pati',
							meaning: '感受，忍受',
							examples: [
								{
									word: 'passion',
									ipa: '/pˈæʃən/',
									pos: 'n.',
									translationZh: '热情',
								},
								{
									word: 'patient',
									ipa: '/pˈeɪʃənt/',
									pos: 'n./adj.',
									translationZh: '耐心的',
								},
								{
									word: 'compatible',
									ipa: '/kəmpˈætəbəl/',
									pos: 'adj.',
									translationZh: '兼容的',
								},
								{
									word: 'passive',
									ipa: '/pˈæsɪv/',
									pos: 'adj.',
									translationZh: '被动的',
								},
							],
						},
						{
							root: 'pater/patr',
							meaning: '父亲',
							examples: [
								{
									word: 'father',
									ipa: '/fˈɑːðə/',
									pos: 'n.',
									translationZh: '父亲',
								},
								{
									word: 'paternal',
									ipa: '/pətˈɜːnəl/',
									pos: 'adj.',
									translationZh: '父亲的',
								},
								{
									word: 'patriot',
									ipa: '/pˈeɪtriːət/',
									pos: 'n.',
									translationZh: '爱国者',
								},
								{
									word: 'patron',
									ipa: '/pˈeɪtrən/',
									pos: 'n.',
									translationZh: '赞助人',
								},
							],
						},
						{
							root: 'ped/pod',
							meaning: '脚，儿童',
							examples: [
								{
									word: 'pedal',
									ipa: '/pˈedəl/',
									pos: 'n.',
									translationZh: '踏板',
								},
								{
									word: 'pedestrian',
									ipa: '/pədˈestriːən/',
									pos: 'n.',
									translationZh: '行人',
								},
								{
									word: 'expedition',
									ipa: '/ˌekspədˈɪʃən/',
									pos: 'n.',
									translationZh: '远征',
								},
							],
						},
						{
							root: 'pel/puls',
							meaning: '推，驱动',
							examples: [
								{
									word: 'compel',
									ipa: '/kəmpˈel/',
									pos: 'v.',
									translationZh: '强迫',
								},
								{
									word: 'expel',
									ipa: '/ɪkspˈel/',
									pos: 'v.',
									translationZh: '驱逐',
								},
								{
									word: 'impulse',
									ipa: '/ˈɪmpəls/',
									pos: 'n.',
									translationZh: '冲动',
								},
								{
									word: 'repel',
									ipa: '/rɪpˈel/',
									pos: 'v.',
									translationZh: '击退',
								},
							],
						},
						{
							root: 'pend/pens',
							meaning: '悬挂，称重，支付',
							examples: [
								{
									word: 'depend',
									ipa: '/dɪpˈend/',
									pos: 'n.',
									translationZh: '依靠',
								},
								{
									word: 'expense',
									ipa: '/ɪkspˈens/',
									pos: 'n.',
									translationZh: '费用',
								},
								{
									word: 'pension',
									ipa: '/pˈenʃən/',
									pos: 'n.',
									translationZh: '养老金',
								},
								{
									word: 'compensate',
									ipa: '/kˈɑːmpənsˌeɪt/',
									pos: 'v.',
									translationZh: '补偿',
								},
							],
						},
						{
							root: 'pet/peat',
							meaning: '寻求，追求',
							examples: [
								{
									word: 'compete',
									ipa: '/kəmpˈiːt/',
									pos: 'v.',
									translationZh: '竞争',
								},
								{
									word: 'appetite',
									ipa: '/ˈæpətˌaɪt/',
									pos: 'n.',
									translationZh: '食欲',
								},
								{
									word: 'repeat',
									ipa: '/rɪpˈiːt/',
									pos: 'n.',
									translationZh: '重复',
								},
								{
									word: 'petition',
									ipa: '/pətˈɪʃən/',
									pos: 'n.',
									translationZh: '请愿',
								},
							],
						},
						{
							root: 'phil',
							meaning: '爱',
							examples: [
								{
									word: 'philosophy',
									ipa: '/fəlˈɑːsəfiː/',
									pos: 'n.',
									translationZh: '哲学',
								},
								{
									word: 'philanthropy',
									ipa: '/fɪlˈænθrəpiː/',
									pos: 'adj.',
									translationZh: '慈善事业',
								},
								{
									word: 'bibliophile',
									ipa: '/ˈbɪbliəfaɪl/',
									pos: 'adj.',
									translationZh: '爱书者',
								},
							],
						},
						{
							root: 'phon',
							meaning: '声音',
							examples: [
								{
									word: 'phone',
									ipa: '/fˈəʊn/',
									pos: 'n.',
									translationZh: '电话',
								},
								{
									word: 'symphony',
									ipa: '/sˈɪmfəniː/',
									pos: 'adj.',
									translationZh: '交响乐',
								},
								{
									word: 'microphone',
									ipa: '/mˈaɪkrəfˌəʊn/',
									pos: 'n.',
									translationZh: '麦克风',
								},
								{
									word: 'phonetics',
									ipa: '/fənˈetɪks/',
									pos: 'n.',
									translationZh: '语音学',
								},
							],
						},
						{
							root: 'photo',
							meaning: '光',
							examples: [
								{
									word: 'photograph',
									ipa: '/fˈəʊtəɡrˌæf/',
									pos: 'n.',
									translationZh: '照片',
								},
								{
									word: 'photosynthesis',
									ipa: '/fˌəʊtəʊsˈɪnθəsɪs/',
									pos: 'n.',
									translationZh: '光合作用',
								},
								{
									word: 'photon',
									ipa: '/fˈəʊtˌɑːn/',
									pos: 'n.',
									translationZh: '光子',
								},
							],
						},
						{
							root: 'plac',
							meaning: '平静',
							examples: [
								{
									word: 'placid',
									ipa: '/plˈæsəd/',
									pos: 'adj.',
									translationZh: '平静的',
								},
								{
									word: 'complacent',
									ipa: '/kəmplˈeɪsənt/',
									pos: 'adj.',
									translationZh: '自满的',
								},
								{
									word: 'implacable',
									ipa: '/ˌɪmplˈækəbəl/',
									pos: 'adj.',
									translationZh: '难以平息的',
								},
							],
						},
						{
							root: 'plic/ply/plex',
							meaning: '折叠，复杂',
							examples: [
								{
									word: 'complicated',
									ipa: '/kˈɑːmpləkˌeɪtəd/',
									pos: 'adj.',
									translationZh: '复杂的',
								},
								{
									word: 'apply',
									ipa: '/əplˈaɪ/',
									pos: 'adv.',
									translationZh: '应用',
								},
								{
									word: 'complex',
									ipa: '/kˈɑːmpleks/',
									pos: 'adj.',
									translationZh: '复杂的',
								},
								{
									word: 'explicit',
									ipa: '/ɪksplˈɪsət/',
									pos: 'adj.',
									translationZh: '明确的',
								},
							],
						},
						{
							root: 'plu/plus',
							meaning: '更多',
							examples: [
								{
									word: 'plus',
									ipa: '/plˈʌs/',
									pos: 'n.',
									translationZh: '加',
								},
								{
									word: 'plural',
									ipa: '/plˈʊrəl/',
									pos: 'n.',
									translationZh: '复数',
								},
								{
									word: 'surplus',
									ipa: '/sˈɜːpləs/',
									pos: 'n.',
									translationZh: '盈余',
								},
							],
						},
						{
							root: 'pon/pos/pound',
							meaning: '放置',
							examples: [
								{
									word: 'position',
									ipa: '/pəzˈɪʃən/',
									pos: 'n.',
									translationZh: '位置',
								},
								{
									word: 'compose',
									ipa: '/kəmpˈəʊz/',
									pos: 'v.',
									translationZh: '组成',
								},
								{
									word: 'compound',
									ipa: '/kˈɑːmpaʊnd/',
									pos: 'n.',
									translationZh: '化合物',
								},
								{
									word: 'postpone',
									ipa: '/pəˈspəʊn/',
									pos: 'n.',
									translationZh: '推迟',
								},
							],
						},
						{
							root: 'port',
							meaning: '携带',
							examples: [
								{
									word: 'portable',
									ipa: '/pˈɔːrtəbəl/',
									pos: 'adj.',
									translationZh: '便携的',
								},
								{
									word: 'transport',
									ipa: '/trænspˈɔːrt/',
									pos: 'v.',
									translationZh: '运输',
								},
								{
									word: 'export',
									ipa: '/ˈekspɔːrt/',
									pos: 'v.',
									translationZh: '出口',
								},
								{
									word: 'import',
									ipa: '/ˌɪmpˈɔːrt/',
									pos: 'n.',
									translationZh: '进口',
								},
							],
						},
						{
							root: 'press',
							meaning: '压',
							examples: [
								{
									word: 'pressure',
									ipa: '/prˈeʃə/',
									pos: 'n.',
									translationZh: '压力',
								},
								{
									word: 'express',
									ipa: '/ɪksprˈes/',
									pos: 'v.',
									translationZh: '表达',
								},
								{
									word: 'impress',
									ipa: '/ˌɪmprˈes/',
									pos: 'v.',
									translationZh: '留下印象',
								},
								{
									word: 'depress',
									ipa: '/dɪprˈes/',
									pos: 'v.',
									translationZh: '使沮丧',
								},
							],
						},
						{
							root: 'prim/prem/prin',
							meaning: '第一，最初',
							examples: [
								{
									word: 'primary',
									ipa: '/prˈaɪmˌeriː/',
									pos: 'n.',
									translationZh: '主要的',
								},
								{
									word: 'premier',
									ipa: '/premˈɪr/',
									pos: 'n.',
									translationZh: '首相',
								},
								{
									word: 'prince',
									ipa: '/prˈɪns/',
									pos: 'n.',
									translationZh: '王子',
								},
								{
									word: 'primitive',
									ipa: '/prˈɪmətɪv/',
									pos: 'adj.',
									translationZh: '原始的',
								},
							],
						},
						{
							root: 'priv',
							meaning: '私人',
							examples: [
								{
									word: 'private',
									ipa: '/prˈaɪvət/',
									pos: 'v.',
									translationZh: '私人的',
								},
								{
									word: 'privacy',
									ipa: '/prˈaɪvəsiː/',
									pos: 'n.',
									translationZh: '隐私',
								},
								{
									word: 'privilege',
									ipa: '/prˈɪvɪlɪdʒ/',
									pos: 'n.',
									translationZh: '特权',
								},
								{
									word: 'deprive',
									ipa: '/dɪprˈaɪv/',
									pos: 'v.',
									translationZh: '剥夺',
								},
							],
						},
						{
							root: 'prob/prov',
							meaning: '测试，证明',
							examples: [
								{
									word: 'prove',
									ipa: '/prˈuːv/',
									pos: 'n.',
									translationZh: '证明',
								},
								{
									word: 'probable',
									ipa: '/prˈɑːbəbəl/',
									pos: 'adj.',
									translationZh: '可能的',
								},
								{
									word: 'approve',
									ipa: '/əprˈuːv/',
									pos: 'v.',
									translationZh: '批准',
								},
								{
									word: 'probe',
									ipa: '/prˈəʊb/',
									pos: 'v.',
									translationZh: '探查',
								},
							],
						},
						{
							root: 'proper/propri',
							meaning: '自己的，财产',
							examples: [
								{
									word: 'property',
									ipa: '/prˈɑːpətiː/',
									pos: 'n.',
									translationZh: '财产',
								},
								{
									word: 'proper',
									ipa: '/prˈɑːpə/',
									pos: 'n.',
									translationZh: '适当的',
								},
								{
									word: 'expropriate',
									ipa: '/eksprˈəʊpriːˌeɪt/',
									pos: 'v.',
									translationZh: '征用',
								},
							],
						},
						{
							root: 'pugn',
							meaning: '战斗',
							examples: [
								{
									word: 'pugnacious',
									ipa: '/pəɡnˈæʃɪs/',
									pos: 'adj.',
									translationZh: '好斗的',
								},
								{
									word: 'impugn',
									ipa: '/ˌɪmpjˈuːn/',
									pos: 'n.',
									translationZh: '质疑',
								},
								{
									word: 'repugnant',
									ipa: '/rɪpˈʌɡnənt/',
									pos: 'adj.',
									translationZh: '令人厌恶的',
								},
							],
						},
						{
							root: 'punct',
							meaning: '点，刺',
							examples: [
								{
									word: 'punctual',
									ipa: '/pˈʌŋktʃuːəl/',
									pos: 'adj.',
									translationZh: '准时的',
								},
								{
									word: 'puncture',
									ipa: '/pˈʌŋktʃə/',
									pos: 'n.',
									translationZh: '刺穿',
								},
								{
									word: 'punctuate',
									ipa: '/pˈʌŋktʃuːˌeɪt/',
									pos: 'v.',
									translationZh: '加标点',
								},
							],
						},
						{
							root: 'quer/quest/quis',
							meaning: '寻求，问',
							examples: [
								{
									word: 'question',
									ipa: '/kwˈestʃən/',
									pos: 'n.',
									translationZh: '问题',
								},
								{
									word: 'request',
									ipa: '/rɪkwˈest/',
									pos: 'n.',
									translationZh: '请求',
								},
								{
									word: 'acquire',
									ipa: '/əkwˈaɪə/',
									pos: 'v.',
									translationZh: '获得',
								},
								{
									word: 'inquisitive',
									ipa: '/ˌɪnkwˈɪzɪtɪv/',
									pos: 'adj.',
									translationZh: '好奇的',
								},
							],
						},
						{
							root: 'qui/quit',
							meaning: '安静',
							examples: [
								{
									word: 'quiet',
									ipa: '/kwˈaɪət/',
									pos: 'adj.',
									translationZh: '安静的',
								},
								{
									word: 'acquit',
									ipa: '/əkwˈɪt/',
									pos: 'v.',
									translationZh: '无罪释放',
								},
								{
									word: 'tranquil',
									ipa: '/trˈæŋkwəl/',
									pos: 'adj.',
									translationZh: '宁静的',
								},
							],
						},
						{
							root: 'radi',
							meaning: '光线，射线',
							examples: [
								{
									word: 'radiant',
									ipa: '/rˈeɪdˌiːənt/',
									pos: 'adj.',
									translationZh: '发光的',
								},
								{
									word: 'radio',
									ipa: '/rˈeɪdiːˌəʊ/',
									pos: 'n.',
									translationZh: '收音机',
								},
								{
									word: 'radiate',
									ipa: '/rˈeɪdiːˌeɪt/',
									pos: 'v.',
									translationZh: '辐射',
								},
								{
									word: 'eradicate',
									ipa: '/ɪrˈædəkˌeɪt/',
									pos: 'v.',
									translationZh: '根除',
								},
							],
						},
						{
							root: 'rect',
							meaning: '直，正确',
							examples: [
								{
									word: 'correct',
									ipa: '/kəˈekt/',
									pos: 'v.',
									translationZh: '正确的',
								},
								{
									word: 'erect',
									ipa: '/ɪrˈekt/',
									pos: 'v.',
									translationZh: '竖立',
								},
								{
									word: 'rectangle',
									ipa: '/rˈektæŋɡəl/',
									pos: 'n.',
									translationZh: '矩形',
								},
								{
									word: 'rectify',
									ipa: '/rˈektəfˌaɪ/',
									pos: 'v.',
									translationZh: '纠正',
								},
							],
						},
						{
							root: 'reg/rect',
							meaning: '统治，直',
							examples: [
								{
									word: 'regulate',
									ipa: '/rˈeɡjəlˌeɪt/',
									pos: 'v.',
									translationZh: '调节',
								},
								{
									word: 'correct',
									ipa: '/kəˈekt/',
									pos: 'v.',
									translationZh: '正确的',
								},
								{
									word: 'erect',
									ipa: '/ɪrˈekt/',
									pos: 'v.',
									translationZh: '竖立',
								},
								{
									word: 'region',
									ipa: '/rˈiːdʒən/',
									pos: 'n.',
									translationZh: '地区',
								},
							],
						},
						{
							root: 'rid/ris',
							meaning: '笑',
							examples: [
								{
									word: 'ridiculous',
									ipa: '/rɪdˈɪkjələs/',
									pos: 'adj.',
									translationZh: '可笑的',
								},
								{
									word: 'deride',
									ipa: '/dɪrˈaɪd/',
									pos: 'n.',
									translationZh: '嘲笑',
								},
							],
						},
						{
							root: 'rog',
							meaning: '问',
							examples: [
								{
									word: 'interrogate',
									ipa: '/ˌɪntˈerəɡˌeɪt/',
									pos: 'v.',
									translationZh: '审问',
								},
								{
									word: 'prerogative',
									ipa: '/prɪrˈɑːɡətɪv/',
									pos: 'n.',
									translationZh: '特权',
								},
								{
									word: 'derogatory',
									ipa: '/dəˈɑːɡətˌɔːriː/',
									pos: 'adj.',
									translationZh: '贬低的',
								},
							],
						},
						{
							root: 'rupt',
							meaning: '断裂',
							examples: [
								{
									word: 'interrupt',
									ipa: '/ˌɪntəˈʌpt/',
									pos: 'v.',
									translationZh: '打断',
								},
								{
									word: 'rupture',
									ipa: '/rˈʌptʃə/',
									pos: 'n.',
									translationZh: '破裂',
								},
								{
									word: 'abrupt',
									ipa: '/əbrˈʌpt/',
									pos: 'adj.',
									translationZh: '突然的',
								},
								{
									word: 'erupt',
									ipa: '/ɪrˈʌpt/',
									pos: 'v.',
									translationZh: '爆发',
								},
							],
						},
						{
							root: 'sacr/sanct/secr',
							meaning: '神圣',
							examples: [
								{
									word: 'sacred',
									ipa: '/sˈeɪkrəd/',
									pos: 'adj.',
									translationZh: '神圣的',
								},
								{
									word: 'sanctuary',
									ipa: '/sˈæŋktʃuːˌeriː/',
									pos: 'n.',
									translationZh: '避难所',
								},
								{
									word: 'consecrate',
									ipa: '/kˈɑːnsəkrˌeɪt/',
									pos: 'v.',
									translationZh: '奉献',
								},
							],
						},
						{
							root: 'sal/san',
							meaning: '健康',
							examples: [
								{
									word: 'healthy',
									ipa: '/hˈelθiː/',
									pos: 'adj.',
									translationZh: '健康的',
								},
								{
									word: 'sanitary',
									ipa: '/sˈænɪtˌeriː/',
									pos: 'adj.',
									translationZh: '卫生的',
								},
								{
									word: 'salute',
									ipa: '/səlˈuːt/',
									pos: 'v.',
									translationZh: '敬礼',
								},
							],
						},
						{
							root: 'sat/satis',
							meaning: '足够',
							examples: [
								{
									word: 'satisfy',
									ipa: '/sˈætəsfˌaɪ/',
									pos: 'adj.',
									translationZh: '满足',
								},
								{
									word: 'saturate',
									ipa: '/sˈætʃəˌeɪt/',
									pos: 'v.',
									translationZh: '使饱和',
								},
								{
									word: 'satire',
									ipa: '/sˈætˌaɪə/',
									pos: 'n.',
									translationZh: '讽刺',
								},
							],
						},
						{
							root: 'sci',
							meaning: '知道',
							examples: [
								{
									word: 'science',
									ipa: '/sˈaɪəns/',
									pos: 'n.',
									translationZh: '科学',
								},
								{
									word: 'conscious',
									ipa: '/kˈɑːnʃəs/',
									pos: 'adj.',
									translationZh: '有意识的',
								},
								{
									word: 'conscience',
									ipa: '/kˈɑːnʃəns/',
									pos: 'n.',
									translationZh: '良心',
								},
								{
									word: 'omniscient',
									ipa: '/ɒmˈnɪsiənt/',
									pos: 'n./adj.',
									translationZh: '全知的',
								},
							],
						},
						{
							root: 'scrib/script',
							meaning: '写',
							examples: [
								{
									word: 'describe',
									ipa: '/dɪskrˈaɪb/',
									pos: 'v.',
									translationZh: '描述',
								},
								{
									word: 'script',
									ipa: '/skrˈɪpt/',
									pos: 'n.',
									translationZh: '剧本',
								},
								{
									word: 'prescribe',
									ipa: '/prəskrˈaɪb/',
									pos: 'v.',
									translationZh: '开处方',
								},
								{
									word: 'subscribe',
									ipa: '/səbskrˈaɪb/',
									pos: 'v.',
									translationZh: '订阅',
								},
							],
						},
						{
							root: 'sec/sequ/su',
							meaning: '跟随',
							examples: [
								{
									word: 'second',
									ipa: '/sˈekənd/',
									pos: 'n.',
									translationZh: '第二',
								},
								{
									word: 'sequence',
									ipa: '/sˈiːkwəns/',
									pos: 'n.',
									translationZh: '序列',
								},
								{
									word: 'consequence',
									ipa: '/kˈɑːnsəkwəns/',
									pos: 'n.',
									translationZh: '结果',
								},
								{
									word: 'pursue',
									ipa: '/pəsˈuː/',
									pos: 'v.',
									translationZh: '追求',
								},
							],
						},
						{
							root: 'sect/seg',
							meaning: '切',
							examples: [
								{
									word: 'section',
									ipa: '/sˈekʃən/',
									pos: 'n.',
									translationZh: '部分',
								},
								{
									word: 'segment',
									ipa: '/sˈeɡmənt/',
									pos: 'n.',
									translationZh: '片段',
								},
								{
									word: 'intersect',
									ipa: '/ˌɪntəsˈekt/',
									pos: 'v.',
									translationZh: '相交',
								},
								{
									word: 'bisect',
									ipa: '/baɪˈsekt/',
									pos: 'n.',
									translationZh: '平分',
								},
							],
						},
						{
							root: 'sed/sid/sess',
							meaning: '坐',
							examples: [
								{
									word: 'sedentary',
									ipa: '/sˈedəntˌeriː/',
									pos: 'adj.',
									translationZh: '久坐的',
								},
								{
									word: 'preside',
									ipa: '/prɪzˈaɪd/',
									pos: 'v.',
									translationZh: '主持',
								},
								{
									word: 'session',
									ipa: '/sˈeʃən/',
									pos: 'n.',
									translationZh: '会议',
								},
								{
									word: 'reside',
									ipa: '/rɪzˈaɪd/',
									pos: 'v.',
									translationZh: '居住',
								},
							],
						},
						{
							root: 'sens/sent',
							meaning: '感觉',
							examples: [
								{
									word: 'sense',
									ipa: '/sˈens/',
									pos: 'n.',
									translationZh: '感觉',
								},
								{
									word: 'sentiment',
									ipa: '/sˈentəmənt/',
									pos: 'n.',
									translationZh: '情感',
								},
								{
									word: 'consent',
									ipa: '/kənsˈent/',
									pos: 'v.',
									translationZh: '同意',
								},
								{
									word: 'resent',
									ipa: '/rɪzˈent/',
									pos: 'v.',
									translationZh: '怨恨',
								},
							],
						},
						{
							root: 'serv',
							meaning: '服务，保存',
							examples: [
								{
									word: 'service',
									ipa: '/sˈɜːvəs/',
									pos: 'n.',
									translationZh: '服务',
								},
								{
									word: 'conserve',
									ipa: '/kənsˈɜːv/',
									pos: 'v.',
									translationZh: '保存',
								},
								{
									word: 'reserve',
									ipa: '/rɪzˈɜːv/',
									pos: 'v.',
									translationZh: '保留',
								},
								{
									word: 'observe',
									ipa: '/əbzˈɜːv/',
									pos: 'v.',
									translationZh: '观察',
								},
							],
						},
						{
							root: 'sign',
							meaning: '标记',
							examples: [
								{
									word: 'sign',
									ipa: '/sˈaɪn/',
									pos: 'n.',
									translationZh: '标记',
								},
								{
									word: 'signal',
									ipa: '/sˈɪɡnəl/',
									pos: 'adj.',
									translationZh: '信号',
								},
								{
									word: 'assign',
									ipa: '/əsˈaɪn/',
									pos: 'v.',
									translationZh: '分配',
								},
								{
									word: 'design',
									ipa: '/dɪzˈaɪn/',
									pos: 'v.',
									translationZh: '设计',
								},
							],
						},
						{
							root: 'simil/simul',
							meaning: '相似',
							examples: [
								{
									word: 'similar',
									ipa: '/sˈɪmələ/',
									pos: 'adj.',
									translationZh: '相似的',
								},
								{
									word: 'simulate',
									ipa: '/sˈɪmjələt/',
									pos: 'v.',
									translationZh: '模拟',
								},
								{
									word: 'simultaneous',
									ipa: '/sˌaɪməltˈeɪniːəs/',
									pos: 'adj.',
									translationZh: '同时的',
								},
								{
									word: 'assimilate',
									ipa: '/əsˈɪməlˌeɪt/',
									pos: 'v.',
									translationZh: '同化',
								},
							],
						},
						{
							root: 'sist/stit/stat',
							meaning: '站立，放置',
							examples: [
								{
									word: 'assist',
									ipa: '/əsˈɪst/',
									pos: 'v.',
									translationZh: '协助',
								},
								{
									word: 'constitute',
									ipa: '/kˈɑːnstətˌuːt/',
									pos: 'v.',
									translationZh: '组成',
								},
								{
									word: 'status',
									ipa: '/stˈætəs/',
									pos: 'n.',
									translationZh: '地位',
								},
								{
									word: 'establish',
									ipa: '/ɪstˈæblɪʃ/',
									pos: 'v.',
									translationZh: '建立',
								},
							],
						},
						{
							root: 'sol',
							meaning: '单独，太阳',
							examples: [
								{
									word: 'solo',
									ipa: '/sˈəʊlˌəʊ/',
									pos: 'n.',
									translationZh: '独奏',
								},
								{
									word: 'solar',
									ipa: '/sˈəʊlə/',
									pos: 'n.',
									translationZh: '太阳的',
								},
								{
									word: 'solitary',
									ipa: '/sˈɑːlətˌeriː/',
									pos: 'adj.',
									translationZh: '孤独的',
								},
								{
									word: 'console',
									ipa: '/kˈɑːnsəʊl/',
									pos: 'n.',
									translationZh: '安慰',
								},
							],
						},
						{
							root: 'solv/solu',
							meaning: '松开，解决',
							examples: [
								{
									word: 'solve',
									ipa: '/sˈɑːlv/',
									pos: 'n.',
									translationZh: '解决',
								},
								{
									word: 'solution',
									ipa: '/səlˈuːʃən/',
									pos: 'n.',
									translationZh: '解决方案',
								},
								{
									word: 'dissolve',
									ipa: '/dɪzˈɑːlv/',
									pos: 'v.',
									translationZh: '溶解',
								},
								{
									word: 'absolute',
									ipa: '/ˈæbsəlˌuːt/',
									pos: 'n.',
									translationZh: '绝对的',
								},
							],
						},
						{
							root: 'somn',
							meaning: '睡眠',
							examples: [
								{
									word: 'insomnia',
									ipa: '/ˌɪnsˈɑːmniːə/',
									pos: 'n.',
									translationZh: '失眠',
								},
								{
									word: 'somnambulist',
									ipa: '/sɒmˈnæmbjəlɪst/',
									pos: 'n.',
									translationZh: '梦游者',
								},
							],
						},
						{
							root: 'son',
							meaning: '声音',
							examples: [
								{
									word: 'sonic',
									ipa: '/sˈɑːnɪk/',
									pos: 'adj.',
									translationZh: '声音的',
								},
								{
									word: 'supersonic',
									ipa: '/sˌuːpəsˈɑːnɪk/',
									pos: 'adj.',
									translationZh: '超音速的',
								},
								{
									word: 'resonate',
									ipa: '/rˈezənˌeɪt/',
									pos: 'v.',
									translationZh: '共鸣',
								},
								{
									word: 'consonant',
									ipa: '/kˈɑːnsənənt/',
									pos: 'adj.',
									translationZh: '一致的',
								},
							],
						},
						{
							root: 'soph',
							meaning: '智慧',
							examples: [
								{
									word: 'philosophy',
									ipa: '/fəlˈɑːsəfiː/',
									pos: 'n.',
									translationZh: '哲学',
								},
								{
									word: 'sophisticated',
									ipa: '/səfˈɪstəkˌeɪtɪd/',
									pos: 'adj.',
									translationZh: '复杂的',
								},
								{
									word: 'sophomore',
									ipa: '/sˈɑːfmˌɔːr/',
									pos: 'n.',
									translationZh: '大二学生',
								},
							],
						},
						{
							root: 'spec/spic/spit',
							meaning: '看',
							examples: [
								{
									word: 'spectacle',
									ipa: '/spˈektəkəl/',
									pos: 'n.',
									translationZh: '景象',
								},
								{
									word: 'suspect',
									ipa: '/səspˈekt/',
									pos: 'n.',
									translationZh: '怀疑',
								},
								{
									word: 'conspicuous',
									ipa: '/kənspˈɪkjuːəs/',
									pos: 'adj.',
									translationZh: '显眼的',
								},
								{
									word: 'despise',
									ipa: '/dɪspˈaɪz/',
									pos: 'adj.',
									translationZh: '鄙视',
								},
							],
						},
						{
							root: 'spir',
							meaning: '呼吸',
							examples: [
								{
									word: 'spirit',
									ipa: '/spˈɪrət/',
									pos: 'n.',
									translationZh: '精神',
								},
								{
									word: 'inspire',
									ipa: '/ˌɪnspˈaɪr/',
									pos: 'v.',
									translationZh: '激励',
								},
								{
									word: 'expire',
									ipa: '/ɪkspˈaɪr/',
									pos: 'v.',
									translationZh: '过期',
								},
								{
									word: 'conspire',
									ipa: '/kənspˈaɪə/',
									pos: 'v.',
									translationZh: '共谋',
								},
							],
						},
						{
							root: 'spond/spons',
							meaning: '承诺',
							examples: [
								{
									word: 'respond',
									ipa: '/rɪspˈɑːnd/',
									pos: 'v.',
									translationZh: '回应',
								},
								{
									word: 'sponsor',
									ipa: '/spˈɑːnsə/',
									pos: 'n.',
									translationZh: '赞助',
								},
								{
									word: 'correspond',
									ipa: '/kˌɔːrəspˈɑːnd/',
									pos: 'v.',
									translationZh: '通信',
								},
								{
									word: 'spontaneous',
									ipa: '/spɑːntˈeɪniːəs/',
									pos: 'adj.',
									translationZh: '自发的',
								},
							],
						},
						{
							root: 'sta/stan',
							meaning: '站立',
							examples: [
								{
									word: 'stand',
									ipa: '/stˈænd/',
									pos: 'v.',
									translationZh: '站立',
								},
								{
									word: 'stable',
									ipa: '/stˈeɪbəl/',
									pos: 'adj.',
									translationZh: '稳定的',
								},
								{
									word: 'obstacle',
									ipa: '/ˈɑːbstəkəl/',
									pos: 'n.',
									translationZh: '障碍',
								},
								{
									word: 'constant',
									ipa: '/kˈɑːnstənt/',
									pos: 'adj.',
									translationZh: '恒定的',
								},
							],
						},
						{
							root: 'stell',
							meaning: '星',
							examples: [
								{
									word: 'stellar',
									ipa: '/stˈelə/',
									pos: 'adj.',
									translationZh: '恒星的',
								},
								{
									word: 'constellation',
									ipa: '/kˌɑːnstəlˈeɪʃən/',
									pos: 'n.',
									translationZh: '星座',
								},
								{
									word: 'interstellar',
									ipa: '/ˌɪntəstˈelə/',
									pos: 'n.',
									translationZh: '星际的',
								},
							],
						},
						{
							root: 'still',
							meaning: '滴',
							examples: [
								{
									word: 'distill',
									ipa: '/dɪstˈɪl/',
									pos: 'v.',
									translationZh: '蒸馏',
								},
								{
									word: 'instill',
									ipa: '/ˌɪnstˈɪl/',
									pos: 'v.',
									translationZh: '逐渐灌输',
								},
							],
						},
						{
							root: 'string/strict/strain',
							meaning: '拉紧',
							examples: [
								{
									word: 'string',
									ipa: '/strˈɪŋ/',
									pos: 'v./adj.',
									translationZh: '线',
								},
								{
									word: 'strict',
									ipa: '/strˈɪkt/',
									pos: 'adj.',
									translationZh: '严格的',
								},
								{
									word: 'constrain',
									ipa: '/kənstrˈeɪn/',
									pos: 'v.',
									translationZh: '限制',
								},
								{
									word: 'restrain',
									ipa: '/riːstrˈeɪn/',
									pos: 'v.',
									translationZh: '克制',
								},
							],
						},
						{
							root: 'struct',
							meaning: '建造',
							examples: [
								{
									word: 'structure',
									ipa: '/strˈʌktʃə/',
									pos: 'n.',
									translationZh: '结构',
								},
								{
									word: 'construct',
									ipa: '/kənstrˈʌkt/',
									pos: 'v.',
									translationZh: '建造',
								},
								{
									word: 'destructive',
									ipa: '/dɪstrˈʌktɪv/',
									pos: 'adj.',
									translationZh: '破坏性的',
								},
								{
									word: 'instruct',
									ipa: '/ˌɪnstrˈʌkt/',
									pos: 'v.',
									translationZh: '指导',
								},
							],
						},
						{
							root: 'sum/sumpt',
							meaning: '拿，使用',
							examples: [
								{
									word: 'consume',
									ipa: '/kənsˈuːm/',
									pos: 'v.',
									translationZh: '消费',
								},
								{
									word: 'assume',
									ipa: '/əsˈuːm/',
									pos: 'v.',
									translationZh: '假设',
								},
								{
									word: 'presume',
									ipa: '/prɪzˈuːm/',
									pos: 'v.',
									translationZh: '推测',
								},
								{
									word: 'sumptuous',
									ipa: '/sˈʌmptʃwəs/',
									pos: 'adj.',
									translationZh: '豪华的',
								},
							],
						},
						{
							root: 'tang/tact/ting',
							meaning: '接触',
							examples: [
								{
									word: 'tangible',
									ipa: '/tˈændʒəbəl/',
									pos: 'adj.',
									translationZh: '可触摸的',
								},
								{
									word: 'contact',
									ipa: '/kˈɑːntˌækt/',
									pos: 'n.',
									translationZh: '接触',
								},
								{
									word: 'contingent',
									ipa: '/kəntˈɪndʒənt/',
									pos: 'adj.',
									translationZh: '依情况而定的',
								},
								{
									word: 'intact',
									ipa: '/ˌɪntˈækt/',
									pos: 'adj.',
									translationZh: '完好无损的',
								},
							],
						},
						{
							root: 'tax/tac',
							meaning: '排列，触摸',
							examples: [
								{
									word: 'tactics',
									ipa: '/tˈæktɪks/',
									pos: 'n.',
									translationZh: '战术',
								},
								{
									word: 'taxi',
									ipa: '/tˈæksiː/',
									pos: 'n.',
									translationZh: '出租车',
								},
								{
									word: 'syntax',
									ipa: '/sˈɪntˌæks/',
									pos: 'n.',
									translationZh: '句法',
								},
								{
									word: 'contact',
									ipa: '/kˈɑːntˌækt/',
									pos: 'n.',
									translationZh: '接触',
								},
							],
						},
						{
							root: 'techn',
							meaning: '技术，艺术',
							examples: [
								{
									word: 'technology',
									ipa: '/teknˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '技术',
								},
								{
									word: 'technical',
									ipa: '/tˈeknɪkəl/',
									pos: 'adj.',
									translationZh: '技术的',
								},
								{
									word: 'technique',
									ipa: '/teknˈiːk/',
									pos: 'n.',
									translationZh: '技巧',
								},
							],
						},
						{
							root: 'tele',
							meaning: '远',
							examples: [
								{
									word: 'telephone',
									ipa: '/tˈeləfˌəʊn/',
									pos: 'n.',
									translationZh: '电话',
								},
								{
									word: 'television',
									ipa: '/tˈeləvˌɪʒən/',
									pos: 'n.',
									translationZh: '电视',
								},
								{
									word: 'telescope',
									ipa: '/tˈeləskˌəʊp/',
									pos: 'n.',
									translationZh: '望远镜',
								},
								{
									word: 'teleport',
									ipa: '/tˈeləpˈɔːrt/',
									pos: 'n.',
									translationZh: '传送',
								},
							],
						},
						{
							root: 'tempor',
							meaning: '时间',
							examples: [
								{
									word: 'temporary',
									ipa: '/ˈtemprəri/',
									pos: 'adj.',
									translationZh: '临时的',
								},
								{
									word: 'contemporary',
									ipa: '/kəntˈempəˌeriː/',
									pos: 'adj.',
									translationZh: '当代的',
								},
								{
									word: 'extempore',
									ipa: '/ɪkˈstempəri/',
									pos: 'n.',
									translationZh: '即席的',
								},
							],
						},
						{
							root: 'ten/tin/tent/tain',
							meaning: '保持，持有',
							examples: [
								{
									word: 'maintain',
									ipa: '/meɪntˈeɪn/',
									pos: 'v.',
									translationZh: '维持',
								},
								{
									word: 'contain',
									ipa: '/kəntˈeɪn/',
									pos: 'v.',
									translationZh: '包含',
								},
								{
									word: 'retain',
									ipa: '/rɪtˈeɪn/',
									pos: 'v.',
									translationZh: '保留',
								},
								{
									word: 'sustain',
									ipa: '/səstˈeɪn/',
									pos: 'v.',
									translationZh: '支撑',
								},
								{
									word: 'tenant',
									ipa: '/tˈenənt/',
									pos: 'n./adj.',
									translationZh: '租户',
								},
							],
						},
						{
							root: 'tend/tens/tent',
							meaning: '伸展，拉紧',
							examples: [
								{
									word: 'extend',
									ipa: '/ɪkstˈend/',
									pos: 'v.',
									translationZh: '延伸',
								},
								{
									word: 'tension',
									ipa: '/tˈenʃən/',
									pos: 'n.',
									translationZh: '紧张',
								},
								{
									word: 'intense',
									ipa: '/ˌɪntˈens/',
									pos: 'adj.',
									translationZh: '强烈的',
								},
								{
									word: 'attend',
									ipa: '/ətˈend/',
									pos: 'v.',
									translationZh: '参加',
								},
							],
						},
						{
							root: 'term',
							meaning: '界限，结束',
							examples: [
								{
									word: 'term',
									ipa: '/tˈɜːm/',
									pos: 'n.',
									translationZh: '学期',
								},
								{
									word: 'determine',
									ipa: '/dətˈɜːmən/',
									pos: 'v.',
									translationZh: '决定',
								},
								{
									word: 'terminal',
									ipa: '/tˈɜːmənəl/',
									pos: 'adj.',
									translationZh: '终点的',
								},
								{
									word: 'exterminate',
									ipa: '/ɪkstˈɜːmənˌeɪt/',
									pos: 'v.',
									translationZh: '消灭',
								},
							],
						},
						{
							root: 'terr',
							meaning: '土地，恐怖',
							examples: [
								{
									word: 'territory',
									ipa: '/tˈerɪtˌɔːriː/',
									pos: 'n.',
									translationZh: '领土',
								},
								{
									word: 'terrain',
									ipa: '/təˈeɪn/',
									pos: 'n.',
									translationZh: '地形',
								},
								{
									word: 'terrible',
									ipa: '/tˈerəbəl/',
									pos: 'adj.',
									translationZh: '可怕的',
								},
								{
									word: 'terror',
									ipa: '/tˈerə/',
									pos: 'n.',
									translationZh: '恐怖',
								},
							],
						},
						{
							root: 'test',
							meaning: '证明',
							examples: [
								{
									word: 'test',
									ipa: '/tˈest/',
									pos: 'n.',
									translationZh: '测试',
								},
								{
									word: 'testify',
									ipa: '/tˈestɪfˌaɪ/',
									pos: 'v.',
									translationZh: '作证',
								},
								{
									word: 'attest',
									ipa: '/ətˈest/',
									pos: 'v.',
									translationZh: '证明',
								},
								{
									word: 'contest',
									ipa: '/kˈɑːntest/',
									pos: 'v.',
									translationZh: '竞赛',
								},
							],
						},
						{
							root: 'text',
							meaning: '编织',
							examples: [
								{
									word: 'text',
									ipa: '/tˈekst/',
									pos: 'n.',
									translationZh: '文本',
								},
								{
									word: 'texture',
									ipa: '/tˈekstʃə/',
									pos: 'n.',
									translationZh: '质地',
								},
								{
									word: 'context',
									ipa: '/kˈɑːntekst/',
									pos: 'n.',
									translationZh: '上下文',
								},
								{
									word: 'pretext',
									ipa: '/prˈiːtˌekst/',
									pos: 'n.',
									translationZh: '借口',
								},
							],
						},
						{
							root: 'the/theo',
							meaning: '神',
							examples: [
								{
									word: 'theology',
									ipa: '/θiːˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '神学',
								},
								{
									word: 'theist',
									ipa: '/ˈθiːɪst/',
									pos: 'n.',
									translationZh: '有神论者',
								},
								{
									word: 'atheist',
									ipa: '/ˈeɪθiɪst/',
									pos: 'n.',
									translationZh: '无神论者',
								},
								{
									word: 'monotheism',
									ipa: '/mˈɑːnəθˌiːɪzəm/',
									pos: 'n.',
									translationZh: '一神论',
								},
							],
						},
						{
							root: 'therm',
							meaning: '热',
							examples: [
								{
									word: 'thermometer',
									ipa: '/θəmˈɑːmətə/',
									pos: 'n.',
									translationZh: '温度计',
								},
								{
									word: 'thermal',
									ipa: '/θˈɜːməl/',
									pos: 'n.',
									translationZh: '热的',
								},
								{
									word: 'thermos',
									ipa: '/θˈɜːməs/',
									pos: 'n.',
									translationZh: '保温瓶',
								},
							],
						},
						{
							root: 'thesis/thet',
							meaning: '放置',
							examples: [
								{
									word: 'thesis',
									ipa: '/θˈiːsˌɪs/',
									pos: 'n.',
									translationZh: '论文',
								},
								{
									word: 'hypothesis',
									ipa: '/haɪpˈɑːθəsəs/',
									pos: 'n.',
									translationZh: '假设',
								},
								{
									word: 'synthesis',
									ipa: '/sˈɪnθəsəs/',
									pos: 'n.',
									translationZh: '综合',
								},
								{
									word: 'antithesis',
									ipa: '/æntˈɪθəsəs/',
									pos: 'n.',
									translationZh: '对立',
								},
							],
						},
						{
							root: 'tom',
							meaning: '切',
							examples: [
								{
									word: 'atom',
									ipa: '/ˈætəm/',
									pos: 'n.',
									translationZh: '原子',
								},
								{
									word: 'anatomy',
									ipa: '/ənˈætəmiː/',
									pos: 'n.',
									translationZh: '解剖',
								},
								{
									word: 'epitome',
									ipa: '/ɪpˈɪtəmiː/',
									pos: 'n.',
									translationZh: '缩影',
								},
								{
									word: 'tome',
									ipa: '/tˈəʊm/',
									pos: 'n.',
									translationZh: '大册书',
								},
							],
						},
						{
							root: 'tort',
							meaning: '扭曲',
							examples: [
								{
									word: 'torture',
									ipa: '/tˈɔːrtʃə/',
									pos: 'v.',
									translationZh: '折磨',
								},
								{
									word: 'distort',
									ipa: '/dɪstˈɔːrt/',
									pos: 'v.',
									translationZh: '扭曲',
								},
								{
									word: 'contort',
									ipa: '/kəntˈɔːrt/',
									pos: 'v.',
									translationZh: '使扭曲',
								},
								{
									word: 'torment',
									ipa: '/tˈɔːrmˌent/',
									pos: 'n.',
									translationZh: '痛苦',
								},
							],
						},
						{
							root: 'tract',
							meaning: '拉，拖',
							examples: [
								{
									word: 'attract',
									ipa: '/ətrˈækt/',
									pos: 'v.',
									translationZh: '吸引',
								},
								{
									word: 'contract',
									ipa: '/kˈɑːntrˌækt/',
									pos: 'v.',
									translationZh: '合同',
								},
								{
									word: 'extract',
									ipa: '/ˈekstrˌækt/',
									pos: 'v.',
									translationZh: '提取',
								},
								{
									word: 'tractor',
									ipa: '/trˈæktə/',
									pos: 'n.',
									translationZh: '拖拉机',
								},
							],
						},
						{
							root: 'trib',
							meaning: '给予，部落',
							examples: [
								{
									word: 'tribute',
									ipa: '/trˈɪbjuːt/',
									pos: 'n.',
									translationZh: '贡品',
								},
								{
									word: 'attribute',
									ipa: '/ətrˈɪbjˌuːt/',
									pos: 'n.',
									translationZh: '归因于',
								},
								{
									word: 'contribute',
									ipa: '/kəntrˈɪbjuːt/',
									pos: 'v.',
									translationZh: '贡献',
								},
								{
									word: 'distribute',
									ipa: '/dɪstrˈɪbjuːt/',
									pos: 'v.',
									translationZh: '分配',
								},
							],
						},
						{
							root: 'turb',
							meaning: '搅动',
							examples: [
								{
									word: 'disturb',
									ipa: '/dɪstˈɜːb/',
									pos: 'v.',
									translationZh: '打扰',
								},
								{
									word: 'turbulent',
									ipa: '/tˈɜːbjələnt/',
									pos: 'adj.',
									translationZh: '动荡的',
								},
								{
									word: 'turbine',
									ipa: '/tˈɜːbaɪn/',
									pos: 'n.',
									translationZh: '涡轮机',
								},
							],
						},
						{
							root: 'umbr',
							meaning: '阴影',
							examples: [
								{
									word: 'umbrella',
									ipa: '/ʌmˈbrelə/',
									pos: 'n.',
									translationZh: '伞',
								},
								{
									word: 'umbrage',
									ipa: '/ˈʌmbrɪdʒ/',
									pos: 'n.',
									translationZh: '不快',
								},
								{
									word: 'adumbrate',
									ipa: '/ˈædʌmbreɪt/',
									pos: 'v.',
									translationZh: '预示',
								},
							],
						},
						{
							root: 'uni',
							meaning: '一',
							examples: [
								{
									word: 'unify',
									ipa: '/jˈuːnəfˌaɪ/',
									pos: 'adj.',
									translationZh: '统一',
								},
								{
									word: 'uniform',
									ipa: '/ˈjuːnɪfɔːm/',
									pos: 'n.',
									translationZh: '制服',
								},
								{
									word: 'universe',
									ipa: '/jˈuːnəvˌɜːs/',
									pos: 'n.',
									translationZh: '宇宙',
								},
								{
									word: 'unite',
									ipa: '/juːˈnaɪt/',
									pos: 'n.',
									translationZh: '联合',
								},
							],
						},
						{
							root: 'urb',
							meaning: '城市',
							examples: [
								{
									word: 'urban',
									ipa: '/ˈɜːbən/',
									pos: 'adj.',
									translationZh: '城市的',
								},
								{
									word: 'suburb',
									ipa: '/sˈʌbəb/',
									pos: 'n.',
									translationZh: '郊区',
								},
								{
									word: 'urbane',
									ipa: '/əbˈeɪn/',
									pos: 'adj.',
									translationZh: '文雅的',
								},
							],
						},
						{
							root: 'us/ut',
							meaning: '使用',
							examples: [
								{
									word: 'use',
									ipa: '/jˈuːs/',
									pos: 'n.',
									translationZh: '使用',
								},
								{
									word: 'utility',
									ipa: '/juːtˈɪlətiː/',
									pos: 'n.',
									translationZh: '效用',
								},
								{
									word: 'abuse',
									ipa: '/əbjˈuːs/',
									pos: 'n.',
									translationZh: '滥用',
								},
								{
									word: 'utilize',
									ipa: '/jˈuːtəlˌaɪz/',
									pos: 'v.',
									translationZh: '利用',
								},
							],
						},
						{
							root: 'vac/van/vod/void',
							meaning: '空',
							examples: [
								{
									word: 'vacant',
									ipa: '/vˈeɪkənt/',
									pos: 'adj.',
									translationZh: '空的',
								},
								{
									word: 'vanish',
									ipa: '/vˈænɪʃ/',
									pos: 'adj.',
									translationZh: '消失',
								},
								{
									word: 'avoid',
									ipa: '/əvˈɔɪd/',
									pos: 'adj.',
									translationZh: '避免',
								},
								{
									word: 'void',
									ipa: '/vˈɔɪd/',
									pos: 'adj.',
									translationZh: '空的',
								},
							],
						},
						{
							root: 'vad/vas',
							meaning: '走，去',
							examples: [
								{
									word: 'invade',
									ipa: '/ˌɪnvˈeɪd/',
									pos: 'v.',
									translationZh: '入侵',
								},
								{
									word: 'evade',
									ipa: '/ɪvˈeɪd/',
									pos: 'v.',
									translationZh: '逃避',
								},
								{
									word: 'pervade',
									ipa: '/pəvˈeɪd/',
									pos: 'v.',
									translationZh: '弥漫',
								},
							],
						},
						{
							root: 'vag',
							meaning: '漫游',
							examples: [
								{
									word: 'vague',
									ipa: '/vˈeɪɡ/',
									pos: 'adj.',
									translationZh: '模糊的',
								},
								{
									word: 'vagrant',
									ipa: '/vˈeɪɡrənt/',
									pos: 'adj.',
									translationZh: '流浪者',
								},
								{
									word: 'extravagant',
									ipa: '/ekstrˈævəɡənt/',
									pos: 'adj.',
									translationZh: '奢侈的',
								},
							],
						},
						{
							root: 'val/vail',
							meaning: '价值，力量',
							examples: [
								{
									word: 'value',
									ipa: '/vˈæljuː/',
									pos: 'n.',
									translationZh: '价值',
								},
								{
									word: 'valid',
									ipa: '/vˈælɪd/',
									pos: 'adj.',
									translationZh: '有效的',
								},
								{
									word: 'available',
									ipa: '/əvˈeɪləbəl/',
									pos: 'adj.',
									translationZh: '可用的',
								},
								{
									word: 'prevail',
									ipa: '/prɪvˈeɪl/',
									pos: 'n.',
									translationZh: '盛行',
								},
							],
						},
						{
							root: 'ven/vent',
							meaning: '来',
							examples: [
								{
									word: 'convention',
									ipa: '/kənvˈenʃən/',
									pos: 'n.',
									translationZh: '会议',
								},
								{
									word: 'prevent',
									ipa: '/prɪvˈent/',
									pos: 'v.',
									translationZh: '阻止',
								},
								{
									word: 'advent',
									ipa: '/ˈædvˌent/',
									pos: 'n.',
									translationZh: '到来',
								},
								{
									word: 'intervene',
									ipa: '/ˌɪntəvˈiːn/',
									pos: 'v.',
									translationZh: '干预',
								},
							],
						},
						{
							root: 'ver',
							meaning: '真实',
							examples: [
								{
									word: 'verify',
									ipa: '/vˈerəfˌaɪ/',
									pos: 'v.',
									translationZh: '核实',
								},
								{
									word: 'very',
									ipa: '/vˈeriː/',
									pos: 'adv.',
									translationZh: '非常',
								},
								{
									word: 'verdict',
									ipa: '/vˈɜːdɪkt/',
									pos: 'n.',
									translationZh: '裁决',
								},
								{
									word: 'veracious',
									ipa: '/vəˈreɪʃəs/',
									pos: 'adj.',
									translationZh: '诚实的',
								},
							],
						},
						{
							root: 'verb',
							meaning: '词',
							examples: [
								{
									word: 'verb',
									ipa: '/vˈɜːb/',
									pos: 'n.',
									translationZh: '动词',
								},
								{
									word: 'verbal',
									ipa: '/vˈɜːbəl/',
									pos: 'adj.',
									translationZh: '口头的',
								},
								{
									word: 'proverb',
									ipa: '/prˈɑːvəb/',
									pos: 'n.',
									translationZh: '谚语',
								},
								{
									word: 'adverb',
									ipa: '/ˈædvəb/',
									pos: 'n.',
									translationZh: '副词',
								},
							],
						},
						{
							root: 'vert/vers',
							meaning: '转',
							examples: [
								{
									word: 'convert',
									ipa: '/kˈɑːnvət/',
									pos: 'v.',
									translationZh: '转换',
								},
								{
									word: 'reverse',
									ipa: '/rɪvˈɜːs/',
									pos: 'v.',
									translationZh: '反转',
								},
								{
									word: 'diverse',
									ipa: '/daɪvˈɜːs/',
									pos: 'adj.',
									translationZh: '多样的',
								},
								{
									word: 'controversy',
									ipa: '/kˈɑːntrəvˌɜːsiː/',
									pos: 'n.',
									translationZh: '争议',
								},
							],
						},
						{
							root: 'vest',
							meaning: '衣服',
							examples: [
								{
									word: 'vest',
									ipa: '/vˈest/',
									pos: 'n.',
									translationZh: '背心',
								},
								{
									word: 'invest',
									ipa: '/ˌɪnvˈest/',
									pos: 'v.',
									translationZh: '投资',
								},
								{
									word: 'divest',
									ipa: '/daɪvˈest/',
									pos: 'n.',
									translationZh: '剥夺',
								},
								{
									word: 'travesty',
									ipa: '/trˈævəstiː/',
									pos: 'n.',
									translationZh: '歪曲',
								},
							],
						},
						{
							root: 'vi/via',
							meaning: '路',
							examples: [
								{
									word: 'way',
									ipa: '/wˈeɪ/',
									pos: 'n.',
									translationZh: '路',
								},
								{
									word: 'via',
									ipa: '/vˈaɪə/',
									pos: 'n.',
									translationZh: '经由',
								},
								{
									word: 'obvious',
									ipa: '/ˈɑːbviːəs/',
									pos: 'adj.',
									translationZh: '明显的',
								},
								{
									word: 'previous',
									ipa: '/prˈiːviːəs/',
									pos: 'adj.',
									translationZh: '以前的',
								},
								{
									word: 'trivial',
									ipa: '/trˈɪviːəl/',
									pos: 'adj.',
									translationZh: '琐碎的',
								},
							],
						},
						{
							root: 'vid/vis',
							meaning: '看',
							examples: [
								{
									word: 'video',
									ipa: '/vˈɪdiːəʊ/',
									pos: 'n.',
									translationZh: '视频',
								},
								{
									word: 'visible',
									ipa: '/vˈɪzəbəl/',
									pos: 'adj.',
									translationZh: '可见的',
								},
								{
									word: 'evident',
									ipa: '/ˈevədənt/',
									pos: 'adj.',
									translationZh: '明显的',
								},
								{
									word: 'provide',
									ipa: '/prəvˈaɪd/',
									pos: 'v.',
									translationZh: '提供',
								},
							],
						},
						{
							root: 'vinc/vict',
							meaning: '征服',
							examples: [
								{
									word: 'victory',
									ipa: '/vˈɪktəriː/',
									pos: 'n.',
									translationZh: '胜利',
								},
								{
									word: 'convince',
									ipa: '/kənvˈɪns/',
									pos: 'v.',
									translationZh: '说服',
								},
								{
									word: 'evict',
									ipa: '/ɪvˈɪkt/',
									pos: 'v.',
									translationZh: '驱逐',
								},
								{
									word: 'invincible',
									ipa: '/ˌɪnvˈɪnsəbəl/',
									pos: 'adj.',
									translationZh: '不可征服的',
								},
							],
						},
						{
							root: 'viv/vit',
							meaning: '生命，活',
							examples: [
								{
									word: 'vivid',
									ipa: '/vˈɪvəd/',
									pos: 'adj.',
									translationZh: '生动的',
								},
								{
									word: 'survive',
									ipa: '/səvˈaɪv/',
									pos: 'v.',
									translationZh: '生存',
								},
								{
									word: 'vital',
									ipa: '/vˈaɪtəl/',
									pos: 'adj.',
									translationZh: '重要的',
								},
								{
									word: 'revive',
									ipa: '/rɪvˈaɪv/',
									pos: 'v.',
									translationZh: '复兴',
								},
							],
						},
						{
							root: 'voc/vok',
							meaning: '声音，叫',
							examples: [
								{
									word: 'voice',
									ipa: '/vˈɔɪs/',
									pos: 'n.',
									translationZh: '声音',
								},
								{
									word: 'vocal',
									ipa: '/vˈəʊkəl/',
									pos: 'adj.',
									translationZh: '声音的',
								},
								{
									word: 'evoke',
									ipa: '/ɪvˈəʊk/',
									pos: 'v.',
									translationZh: '唤起',
								},
								{
									word: 'advocate',
									ipa: '/ˈædvəkət/',
									pos: 'v.',
									translationZh: '提倡',
								},
							],
						},
						{
							root: 'vol',
							meaning: '意志，意愿',
							examples: [
								{
									word: 'voluntary',
									ipa: '/vˈɑːlənteriː/',
									pos: 'adj.',
									translationZh: '自愿的',
								},
								{
									word: 'volunteer',
									ipa: '/vˌɑːləntˈɪr/',
									pos: 'n.',
									translationZh: '志愿者',
								},
								{
									word: 'benevolent',
									ipa: '/bənˈevələnt/',
									pos: 'n./adj.',
									translationZh: '仁慈的',
								},
							],
						},
						{
							root: 'volv/volut',
							meaning: '卷，转',
							examples: [
								{
									word: 'evolve',
									ipa: '/ɪvˈɑːlv/',
									pos: 'v.',
									translationZh: '进化',
								},
								{
									word: 'revolve',
									ipa: '/riːvˈɑːlv/',
									pos: 'v.',
									translationZh: '旋转',
								},
								{
									word: 'involve',
									ipa: '/ˌɪnvˈɑːlv/',
									pos: 'v.',
									translationZh: '涉及',
								},
								{
									word: 'revolution',
									ipa: '/rˌevəlˈuːʃən/',
									pos: 'n.',
									translationZh: '革命',
								},
							],
						},
						{
							root: 'vor',
							meaning: '吃',
							examples: [
								{
									word: 'devour',
									ipa: '/dɪvˈaʊə/',
									pos: 'v.',
									translationZh: '吞食',
								},
								{
									word: 'carnivore',
									ipa: '/kˈɑːrnɪvˌɔːr/',
									pos: 'adj.',
									translationZh: '食肉动物',
								},
								{
									word: 'herbivore',
									ipa: '/hˈɜːbɪvˌɔːr/',
									pos: 'adj.',
									translationZh: '食草动物',
								},
								{
									word: 'voracious',
									ipa: '/vɔːrˈeɪʃəs/',
									pos: 'adj.',
									translationZh: '贪婪的',
								},
							],
						},
					],
				},
				{
					name: '希腊词根 (Greek Roots)',
					items: [
						{
							root: 'aero',
							meaning: '空气',
							examples: [
								{
									word: 'aerodynamics',
									ipa: '/ˌeərəʊdaɪˈnæmɪks/',
									pos: 'n.',
									translationZh: '空气动力学',
								},
								{
									word: 'aerospace',
									ipa: '/ˈerəʊspˌeɪs/',
									pos: 'n.',
									translationZh: '航空航天',
								},
								{
									word: 'aerobic',
									ipa: '/erˈəʊbɪk/',
									pos: 'adj.',
									translationZh: '有氧的',
								},
							],
						},
						{
							root: 'anthropo',
							meaning: '人',
							examples: [
								{
									word: 'anthropology',
									ipa: '/ˌænθrəpˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '人类学',
								},
								{
									word: 'philanthropy',
									ipa: '/fɪlˈænθrəpiː/',
									pos: 'adj.',
									translationZh: '慈善事业',
								},
								{
									word: 'misanthrope',
									ipa: '/mˈɪsənθrˌəʊp/',
									pos: 'n.',
									translationZh: '厌世者',
								},
							],
						},
						{
							root: 'arch/archi',
							meaning: '首要，统治',
							examples: [
								{
									word: 'architect',
									ipa: '/ˈɑːrkətˌekt/',
									pos: 'n.',
									translationZh: '建筑师',
								},
								{
									word: 'monarchy',
									ipa: '/mˈɑːnɑːrkiː/',
									pos: 'n.',
									translationZh: '君主制',
								},
								{
									word: 'anarchy',
									ipa: '/ˈænəkˌiː/',
									pos: 'n.',
									translationZh: '无政府状态',
								},
							],
						},
						{
							root: 'aster/astro',
							meaning: '星',
							examples: [
								{
									word: 'astronomy',
									ipa: '/əstrˈɑːnəmiː/',
									pos: 'adj.',
									translationZh: '天文学',
								},
								{
									word: 'astronaut',
									ipa: '/ˈæstrənˌɑːt/',
									pos: 'n.',
									translationZh: '宇航员',
								},
								{
									word: 'disaster',
									ipa: '/dɪzˈæstə/',
									pos: 'n.',
									translationZh: '灾难',
								},
								{
									word: 'asteroid',
									ipa: '/ˈæstəˌɔɪd/',
									pos: 'adj.',
									translationZh: '小行星',
								},
							],
						},
						{
							root: 'biblio',
							meaning: '书',
							examples: [
								{
									word: 'bibliography',
									ipa: '/ˌbɪbliˈɒɡrəfi/',
									pos: 'n.',
									translationZh: '参考书目',
								},
								{
									word: 'bible',
									ipa: '/bˈaɪbəl/',
									pos: 'adj.',
									translationZh: '圣经',
								},
								{
									word: 'bibliophile',
									ipa: '/ˈbɪbliəfaɪl/',
									pos: 'adj.',
									translationZh: '爱书者',
								},
							],
						},
						{
							root: 'bio',
							meaning: '生命',
							examples: [
								{
									word: 'biology',
									ipa: '/baɪˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '生物学',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
								{
									word: 'symbiosis',
									ipa: '/sˌɪmbaɪˈəʊsəs/',
									pos: 'n.',
									translationZh: '共生',
								},
								{
									word: 'biodegradable',
									ipa: '/bˌaɪəʊdəɡrˈeɪdəbəl/',
									pos: 'adj.',
									translationZh: '可生物降解的',
								},
							],
						},
						{
							root: 'cardio',
							meaning: '心',
							examples: [
								{
									word: 'cardiology',
									ipa: '/kˌɑːrdiːˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '心脏病学',
								},
								{
									word: 'cardiac',
									ipa: '/kˈɑːrdiːˌæk/',
									pos: 'n.',
									translationZh: '心脏的',
								},
								{
									word: 'electrocardiogram',
									ipa: '/ˌɪlˌektrəʊkˈɑːrdiːəɡrˌæm/',
									pos: 'n.',
									translationZh: '心电图',
								},
							],
						},
						{
							root: 'chron',
							meaning: '时间',
							examples: [
								{
									word: 'chronology',
									ipa: '/krənˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '年代学',
								},
								{
									word: 'chronic',
									ipa: '/krˈɑːnɪk/',
									pos: 'adj.',
									translationZh: '慢性的',
								},
								{
									word: 'synchronize',
									ipa: '/sˈɪŋkrənˌaɪz/',
									pos: 'v.',
									translationZh: '同步',
								},
								{
									word: 'anachronism',
									ipa: '/ənˈækrənˌɪzəm/',
									pos: 'n.',
									translationZh: '时代错误',
								},
							],
						},
						{
							root: 'cosmo/cosm',
							meaning: '宇宙，秩序',
							examples: [
								{
									word: 'cosmos',
									ipa: '/kˈɑːzməʊs/',
									pos: 'n.',
									translationZh: '宇宙',
								},
								{
									word: 'cosmic',
									ipa: '/kˈɑːzmɪk/',
									pos: 'adj.',
									translationZh: '宇宙的',
								},
								{
									word: 'cosmopolitan',
									ipa: '/kˌɑːzməpˈɑːlətən/',
									pos: 'n.',
									translationZh: '世界性的',
								},
								{
									word: 'microcosm',
									ipa: '/mˈaɪkrəkˌɑːzəm/',
									pos: 'n.',
									translationZh: '微观世界',
								},
							],
						},
						{
							root: 'cracy/crat',
							meaning: '统治',
							examples: [
								{
									word: 'democracy',
									ipa: '/dɪmˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '民主',
								},
								{
									word: 'bureaucracy',
									ipa: '/bjʊrˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '官僚',
								},
								{
									word: 'aristocrat',
									ipa: '/əˈɪstəkrˌæt/',
									pos: 'n.',
									translationZh: '贵族',
								},
								{
									word: 'autocrat',
									ipa: '/ˈɔːtəkrˌæt/',
									pos: 'n.',
									translationZh: '独裁者',
								},
							],
						},
						{
							root: 'cycl',
							meaning: '圆，轮',
							examples: [
								{
									word: 'cycle',
									ipa: '/sˈaɪkəl/',
									pos: 'n.',
									translationZh: '循环',
								},
								{
									word: 'bicycle',
									ipa: '/ˈbaɪsɪkəl/',
									pos: 'n.',
									translationZh: '自行车',
								},
								{
									word: 'cyclone',
									ipa: '/sɪklˈəʊn/',
									pos: 'n.',
									translationZh: '旋风',
								},
								{
									word: 'encyclopedia',
									ipa: '/ɪnsˌaɪkləpˈiːdiːə/',
									pos: 'n.',
									translationZh: '百科全书',
								},
							],
						},
						{
							root: 'dem/demo',
							meaning: '人民',
							examples: [
								{
									word: 'democracy',
									ipa: '/dɪmˈɑːkrəsiː/',
									pos: 'n.',
									translationZh: '民主',
								},
								{
									word: 'demographics',
									ipa: '/dˌeməɡrˈæfɪks/',
									pos: 'n.',
									translationZh: '人口统计',
								},
								{
									word: 'epidemic',
									ipa: '/ˌepədˈemɪk/',
									pos: 'adj.',
									translationZh: '流行病',
								},
								{
									word: 'pandemic',
									ipa: '/pændˈemɪk/',
									pos: 'adj.',
									translationZh: '大流行病',
								},
							],
						},
						{
							root: 'derm/dermat',
							meaning: '皮肤',
							examples: [
								{
									word: 'dermatology',
									ipa: '/dˌɜːmətˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '皮肤病学',
								},
								{
									word: 'hypodermic',
									ipa: '/hˌaɪpədˈɜːmɪk/',
									pos: 'adj.',
									translationZh: '皮下的',
								},
								{
									word: 'epidermis',
									ipa: '/ˌepɪdˈɜːməs/',
									pos: 'n.',
									translationZh: '表皮',
								},
							],
						},
						{
							root: 'dynam',
							meaning: '力量',
							examples: [
								{
									word: 'dynamic',
									ipa: '/daɪnˈæmɪk/',
									pos: 'adj.',
									translationZh: '动态的',
								},
								{
									word: 'dynamite',
									ipa: '/dˈaɪnəmˌaɪt/',
									pos: 'n.',
									translationZh: '炸药',
								},
								{
									word: 'aerodynamics',
									ipa: '/ˌeərəʊdaɪˈnæmɪks/',
									pos: 'n.',
									translationZh: '空气动力学',
								},
							],
						},
						{
							root: 'ethno',
							meaning: '种族',
							examples: [
								{
									word: 'ethnic',
									ipa: '/ˈeθnɪk/',
									pos: 'adj.',
									translationZh: '种族的',
								},
								{
									word: 'ethnology',
									ipa: '/eθnˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '民族学',
								},
								{
									word: 'ethnocentric',
									ipa: '/ˌeθnəʊsˈentrɪk/',
									pos: 'adj.',
									translationZh: '种族中心主义的',
								},
							],
						},
						{
							root: 'gamy',
							meaning: '婚姻',
							examples: [
								{
									word: 'monogamy',
									ipa: '/mənˈɑːɡəmiː/',
									pos: 'adj.',
									translationZh: '一夫一妻制',
								},
								{
									word: 'polygamy',
									ipa: '/pəlˈɪɡəmˌiː/',
									pos: 'adj.',
									translationZh: '一夫多妻制',
								},
								{
									word: 'bigamy',
									ipa: '/ˈbɪɡəmi/',
									pos: 'adj.',
									translationZh: '重婚',
								},
							],
						},
						{
							root: 'gen/gon',
							meaning: '产生，种族',
							examples: [
								{
									word: 'genesis',
									ipa: '/dʒˈenəsəs/',
									pos: 'n.',
									translationZh: '起源',
								},
								{
									word: 'genetics',
									ipa: '/dʒənˈetɪks/',
									pos: 'n.',
									translationZh: '遗传学',
								},
								{
									word: 'carcinogen',
									ipa: '/kɑːrsˈɪnədʒən/',
									pos: 'v.',
									translationZh: '致癌物',
								},
								{
									word: 'pathogen',
									ipa: '/pˈæθədʒən/',
									pos: 'v.',
									translationZh: '病原体',
								},
							],
						},
						{
							root: 'geo',
							meaning: '地球，土地',
							examples: [
								{
									word: 'geography',
									ipa: '/dʒiːˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '地理',
								},
								{
									word: 'geology',
									ipa: '/dʒiːˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '地质学',
								},
								{
									word: 'geometry',
									ipa: '/dʒiːˈɑːmətriː/',
									pos: 'n.',
									translationZh: '几何',
								},
								{
									word: 'geothermal',
									ipa: '/dʒˌiːəʊθˈɜːməl/',
									pos: 'n.',
									translationZh: '地热的',
								},
							],
						},
						{
							root: 'gon',
							meaning: '角',
							examples: [
								{
									word: 'polygon',
									ipa: '/ˈpɒliɡɒn/',
									pos: 'n.',
									translationZh: '多边形',
								},
								{
									word: 'pentagon',
									ipa: '/pˈentɪɡˌɑːn/',
									pos: 'n.',
									translationZh: '五角形',
								},
								{
									word: 'hexagon',
									ipa: '/hˈeksəɡˌɑːn/',
									pos: 'n.',
									translationZh: '六边形',
								},
							],
						},
						{
							root: 'gram/graph',
							meaning: '写，画，记录',
							examples: [
								{
									word: 'grammar',
									ipa: '/ɡrˈæmə/',
									pos: 'n.',
									translationZh: '语法',
								},
								{
									word: 'telegram',
									ipa: '/tˈeləɡrˌæm/',
									pos: 'n.',
									translationZh: '电报',
								},
								{
									word: 'photograph',
									ipa: '/fˈəʊtəɡrˌæf/',
									pos: 'n.',
									translationZh: '照片',
								},
								{
									word: 'biography',
									ipa: '/baɪˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '传记',
								},
							],
						},
						{
							root: 'gyn/gynec',
							meaning: '女人',
							examples: [
								{
									word: 'gynecology',
									ipa: '/ɡˌaɪnəkˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '妇科学',
								},
								{
									word: 'misogyny',
									ipa: '/mˈɪzədʒɪniː/',
									pos: 'adj.',
									translationZh: '厌女症',
								},
								{
									word: 'androgynous',
									ipa: '/ændrˈɔːdʒənəs/',
									pos: 'adj.',
									translationZh: '雌雄同体的',
								},
							],
						},
						{
							root: 'hem/hema/hemato',
							meaning: '血',
							examples: [
								{
									word: 'hemoglobin',
									ipa: '/hˌiːməɡlˈəʊbən/',
									pos: 'n.',
									translationZh: '血红蛋白',
								},
								{
									word: 'hemorrhage',
									ipa: '/hˈeməɪdʒ/',
									pos: 'n.',
									translationZh: '出血',
								},
								{
									word: 'hematology',
									ipa: '/hˌemətˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '血液学',
								},
							],
						},
						{
							root: 'hydr',
							meaning: '水',
							examples: [
								{
									word: 'hydrant',
									ipa: '/hˈaɪdrənt/',
									pos: 'n.',
									translationZh: '消防栓',
								},
								{
									word: 'hydraulic',
									ipa: '/haɪdrˈɔːlɪk/',
									pos: 'adj.',
									translationZh: '液压的',
								},
								{
									word: 'dehydrate',
									ipa: '/dɪhˈaɪdreɪt/',
									pos: 'v.',
									translationZh: '脱水',
								},
								{
									word: 'hydroelectric',
									ipa: '/hˌaɪdrəʊɪlˈektrɪk/',
									pos: 'adj.',
									translationZh: '水电的',
								},
							],
						},
						{
							root: 'hypno',
							meaning: '睡眠',
							examples: [
								{
									word: 'hypnosis',
									ipa: '/hɪpˈnəʊsɪs/',
									pos: 'n.',
									translationZh: '催眠',
								},
								{
									word: 'hypnotic',
									ipa: '/hɪpnˈɑːtɪk/',
									pos: 'adj.',
									translationZh: '催眠的',
								},
								{
									word: 'hypnotherapy',
									ipa: '/ˌhɪpnəʊˈθerəpi/',
									pos: 'adj.',
									translationZh: '催眠疗法',
								},
							],
						},
						{
							root: 'log/logue',
							meaning: '说话，推理，学科',
							examples: [
								{
									word: 'logic',
									ipa: '/lˈɑːdʒɪk/',
									pos: 'n.',
									translationZh: '逻辑',
								},
								{
									word: 'dialogue',
									ipa: '/dˈaɪəlˌɔːɡ/',
									pos: 'n.',
									translationZh: '对话',
								},
								{
									word: 'biology',
									ipa: '/baɪˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '生物学',
								},
								{
									word: 'psychology',
									ipa: '/saɪkˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '心理学',
								},
							],
						},
						{
							root: 'macro',
							meaning: '大，长',
							examples: [
								{
									word: 'macroeconomics',
									ipa: '/mˌækrəʊekənˈɑːmɪks/',
									pos: 'n.',
									translationZh: '宏观经济学',
								},
								{
									word: 'macroscopic',
									ipa: '/ˌmækrəˈskɒpɪk/',
									pos: 'adj.',
									translationZh: '宏观的',
								},
								{
									word: 'macronutrient',
									ipa: '/ˌmækrəʊˈnjuːtriənt/',
									pos: 'n./adj.',
									translationZh: '大量营养素',
								},
							],
						},
						{
							root: 'mega',
							meaning: '大，百万',
							examples: [
								{
									word: 'megabyte',
									ipa: '/mˈeɡəbˌaɪt/',
									pos: 'n.',
									translationZh: '兆字节',
								},
								{
									word: 'megalopolis',
									ipa: '/mˌeɡəlˈɑːpələs/',
									pos: 'n.',
									translationZh: '特大城市',
								},
								{
									word: 'megaphone',
									ipa: '/ˈmeɡəfəʊn/',
									pos: 'n.',
									translationZh: '扩音器',
								},
							],
						},
						{
							root: 'micro',
							meaning: '小，微',
							examples: [
								{
									word: 'microscope',
									ipa: '/ˈmaɪkrəskəʊp/',
									pos: 'n.',
									translationZh: '显微镜',
								},
								{
									word: 'microorganism',
									ipa: '/mˌaɪkrəʊˈɔːrɡənˌɪzəm/',
									pos: 'n.',
									translationZh: '微生物',
								},
								{
									word: 'microwave',
									ipa: '/ˈmaɪkrəweɪv/',
									pos: 'n.',
									translationZh: '微波',
								},
								{
									word: 'microchip',
									ipa: '/mˈaɪkrˌəʊtʃˈɪp/',
									pos: 'n.',
									translationZh: '微芯片',
								},
							],
						},
						{
							root: 'morph',
							meaning: '形状，形式',
							examples: [
								{
									word: 'morphology',
									ipa: '/mɔːrfˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '形态学',
								},
								{
									word: 'metamorphosis',
									ipa: '/mˌetəmˈɔːrfəsəs/',
									pos: 'n.',
									translationZh: '变形',
								},
								{
									word: 'amorphous',
									ipa: '/əmˈɔːrfəs/',
									pos: 'adj.',
									translationZh: '无定形的',
								},
								{
									word: 'anthropomorphic',
									ipa: '/ˌænθrəpəmˈɔːrfɪk/',
									pos: 'adj.',
									translationZh: '拟人的',
								},
							],
						},
						{
							root: 'narc',
							meaning: '麻木，睡眠',
							examples: [
								{
									word: 'narcotic',
									ipa: '/nɑːˈkɒtɪk/',
									pos: 'adj.',
									translationZh: '麻醉剂',
								},
								{
									word: 'narcissism',
									ipa: '/nˈɑːrsɪsˌɪzəm/',
									pos: 'n.',
									translationZh: '自恋',
								},
								{
									word: 'narcosis',
									ipa: '/nɑːˈkəʊsɪs/',
									pos: 'n.',
									translationZh: '麻醉状态',
								},
							],
						},
						{
							root: 'neur/neuro',
							meaning: '神经',
							examples: [
								{
									word: 'neurology',
									ipa: '/nʊrˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '神经学',
								},
								{
									word: 'neuroscience',
									ipa: '/njˈʊrəʊsˌaɪəns/',
									pos: 'n.',
									translationZh: '神经科学',
								},
								{
									word: 'neurosis',
									ipa: '/nʊrˈəʊsəs/',
									pos: 'n.',
									translationZh: '神经症',
								},
								{
									word: 'neurotransmitter',
									ipa: '/ˌnjʊərəʊtrænzˈmɪtə/',
									pos: 'n.',
									translationZh: '神经递质',
								},
							],
						},
						{
							root: 'nom/nym/onym',
							meaning: '名字，法则',
							examples: [
								{
									word: 'synonym',
									ipa: '/sˈɪnənˌɪm/',
									pos: 'n.',
									translationZh: '同义词',
								},
								{
									word: 'antonym',
									ipa: '/ˈæntənɪm/',
									pos: 'n.',
									translationZh: '反义词',
								},
								{
									word: 'anonymous',
									ipa: '/ənˈɑːnəməs/',
									pos: 'adj.',
									translationZh: '匿名的',
								},
								{
									word: 'astronomy',
									ipa: '/əstrˈɑːnəmiː/',
									pos: 'adj.',
									translationZh: '天文学',
								},
							],
						},
						{
							root: 'oct',
							meaning: '八',
							examples: [
								{
									word: 'octagon',
									ipa: '/ˈɑːktəɡˌɑːn/',
									pos: 'n.',
									translationZh: '八边形',
								},
								{
									word: 'octopus',
									ipa: '/ˈɑːktəpˌʊs/',
									pos: 'n.',
									translationZh: '章鱼',
								},
								{
									word: 'octave',
									ipa: '/ˈɑːktɪv/',
									pos: 'n.',
									translationZh: '八度音阶',
								},
							],
						},
						{
							root: 'opt/ops',
							meaning: '眼睛，视觉',
							examples: [
								{
									word: 'optics',
									ipa: '/ˈɑːptɪks/',
									pos: 'n.',
									translationZh: '光学',
								},
								{
									word: 'optician',
									ipa: '/ɑːptˈɪʃən/',
									pos: 'n.',
									translationZh: '验光师',
								},
								{
									word: 'synopsis',
									ipa: '/sɪnˈɑːpsɪs/',
									pos: 'n.',
									translationZh: '概要',
								},
								{
									word: 'myopia',
									ipa: '/maɪˈəʊpiːə/',
									pos: 'n.',
									translationZh: '近视',
								},
							],
						},
						{
							root: 'ortho',
							meaning: '直，正确',
							examples: [
								{
									word: 'orthodox',
									ipa: '/ˈɔːrθədˌɑːks/',
									pos: 'n.',
									translationZh: '正统的',
								},
								{
									word: 'orthopedics',
									ipa: '/ˌɔːθəʊˈpiːdɪks/',
									pos: 'n.',
									translationZh: '矫形外科',
								},
								{
									word: 'orthodontics',
									ipa: '/ˌɔːrθədˈɑːntɪks/',
									pos: 'n.',
									translationZh: '正畸学',
								},
							],
						},
						{
							root: 'path/patho',
							meaning: '感觉，疾病',
							examples: [
								{
									word: 'sympathy',
									ipa: '/sˈɪmpəθiː/',
									pos: 'adj.',
									translationZh: '同情',
								},
								{
									word: 'pathology',
									ipa: '/pəθˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '病理学',
								},
								{
									word: 'psychopath',
									ipa: '/sˈaɪkəʊpˌæθ/',
									pos: 'n.',
									translationZh: '精神病患者',
								},
								{
									word: 'apathy',
									ipa: '/ˈæpəθiː/',
									pos: 'adj.',
									translationZh: '冷漠',
								},
							],
						},
						{
							root: 'ped',
							meaning: '儿童，教育',
							examples: [
								{
									word: 'pedagogy',
									ipa: '/pˈedəɡˌəʊdʒiː/',
									pos: 'adj.',
									translationZh: '教育学',
								},
								{
									word: 'pediatrician',
									ipa: '/pˌiːdiːətrˈɪʃən/',
									pos: 'n.',
									translationZh: '儿科医生',
								},
								{
									word: 'encyclopedia',
									ipa: '/ɪnsˌaɪkləpˈiːdiːə/',
									pos: 'n.',
									translationZh: '百科全书',
								},
							],
						},
						{
							root: 'phag',
							meaning: '吃',
							examples: [
								{
									word: 'phagocyte',
									ipa: '/fˈæɡəsˌaɪt/',
									pos: 'n.',
									translationZh: '吞噬细胞',
								},
								{
									word: 'autophagy',
									ipa: '/ɔːˈtɒfədʒi/',
									pos: 'adj.',
									translationZh: '自噬',
								},
								{
									word: 'coprophagous',
									ipa: '/kɒˈprɒfəɡəs/',
									pos: 'adj.',
									translationZh: '食粪的',
								},
							],
						},
						{
							root: 'phil/philo',
							meaning: '爱',
							examples: [
								{
									word: 'philosophy',
									ipa: '/fəlˈɑːsəfiː/',
									pos: 'n.',
									translationZh: '哲学',
								},
								{
									word: 'philanthropy',
									ipa: '/fɪlˈænθrəpiː/',
									pos: 'adj.',
									translationZh: '慈善事业',
								},
								{
									word: 'bibliophile',
									ipa: '/ˈbɪbliəfaɪl/',
									pos: 'adj.',
									translationZh: '爱书者',
								},
								{
									word: 'Anglophile',
									ipa: '/ˈænɡləfˌaɪl/',
									pos: 'adj.',
									translationZh: '亲英者',
								},
							],
						},
						{
							root: 'phob',
							meaning: '恐惧',
							examples: [
								{
									word: 'phobia',
									ipa: '/fˈəʊbiːə/',
									pos: 'n.',
									translationZh: '恐惧症',
								},
								{
									word: 'claustrophobia',
									ipa: '/klˌɔːstrəfˈəʊbiːə/',
									pos: 'n.',
									translationZh: '幽闭恐惧症',
								},
								{
									word: 'xenophobia',
									ipa: '/zˌenəfˈəʊbiːə/',
									pos: 'n.',
									translationZh: '仇外心理',
								},
								{
									word: 'acrophobia',
									ipa: '/əˈkrəʊfəʊbiə/',
									pos: 'n.',
									translationZh: '恐高症',
								},
							],
						},
						{
							root: 'phon',
							meaning: '声音',
							examples: [
								{
									word: 'phone',
									ipa: '/fˈəʊn/',
									pos: 'n.',
									translationZh: '电话',
								},
								{
									word: 'symphony',
									ipa: '/sˈɪmfəniː/',
									pos: 'adj.',
									translationZh: '交响乐',
								},
								{
									word: 'microphone',
									ipa: '/mˈaɪkrəfˌəʊn/',
									pos: 'n.',
									translationZh: '麦克风',
								},
								{
									word: 'euphony',
									ipa: '/jˈuːfəniː/',
									pos: 'adj.',
									translationZh: '悦耳的声音',
								},
							],
						},
						{
							root: 'photo',
							meaning: '光',
							examples: [
								{
									word: 'photograph',
									ipa: '/fˈəʊtəɡrˌæf/',
									pos: 'n.',
									translationZh: '照片',
								},
								{
									word: 'photosynthesis',
									ipa: '/fˌəʊtəʊsˈɪnθəsɪs/',
									pos: 'n.',
									translationZh: '光合作用',
								},
								{
									word: 'photon',
									ipa: '/fˈəʊtˌɑːn/',
									pos: 'n.',
									translationZh: '光子',
								},
								{
									word: 'photovoltaic',
									ipa: '/fˌəʊtəvˌəʊltˈeɪɪk/',
									pos: 'adj.',
									translationZh: '光伏的',
								},
							],
						},
						{
							root: 'polis/polit',
							meaning: '城市，公民',
							examples: [
								{
									word: 'metropolis',
									ipa: '/mətrˈɑːpələs/',
									pos: 'n.',
									translationZh: '大都市',
								},
								{
									word: 'politics',
									ipa: '/pˈɑːlətˌɪks/',
									pos: 'n.',
									translationZh: '政治',
								},
								{
									word: 'cosmopolitan',
									ipa: '/kˌɑːzməpˈɑːlətən/',
									pos: 'n.',
									translationZh: '世界性的',
								},
								{
									word: 'acropolis',
									ipa: '/əkrˈɑːpələs/',
									pos: 'n.',
									translationZh: '卫城',
								},
							],
						},
						{
							root: 'poly',
							meaning: '多',
							examples: [
								{
									word: 'polygon',
									ipa: '/ˈpɒliɡɒn/',
									pos: 'n.',
									translationZh: '多边形',
								},
								{
									word: 'polyglot',
									ipa: '/ˈpɒliɡlɒt/',
									pos: 'n.',
									translationZh: '通晓多种语言的人',
								},
								{
									word: 'polymer',
									ipa: '/pˈɑːləmə/',
									pos: 'n.',
									translationZh: '聚合物',
								},
								{
									word: 'polytechnic',
									ipa: '/pˌɑːlɪtˈeknɪk/',
									pos: 'adj.',
									translationZh: '理工学院的',
								},
							],
						},
						{
							root: 'psych',
							meaning: '精神，心灵',
							examples: [
								{
									word: 'psychology',
									ipa: '/saɪkˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '心理学',
								},
								{
									word: 'psychiatry',
									ipa: '/saɪkˈaɪətriː/',
									pos: 'n.',
									translationZh: '精神病学',
								},
								{
									word: 'psychic',
									ipa: '/sˈaɪkɪk/',
									pos: 'adj.',
									translationZh: '灵媒',
								},
								{
									word: 'psychedelic',
									ipa: '/sˌaɪkədˈelɪk/',
									pos: 'adj.',
									translationZh: '迷幻的',
								},
							],
						},
						{
							root: 'pyr',
							meaning: '火',
							examples: [
								{
									word: 'pyromania',
									ipa: '/ˌpaɪrəʊˈmeɪniə/',
									pos: 'n.',
									translationZh: '纵火狂',
								},
								{
									word: 'pyrotechnics',
									ipa: '/pˌaɪrəʊtˈeknɪks/',
									pos: 'n.',
									translationZh: '烟火制造术',
								},
							],
						},
						{
							root: 'scop/scope',
							meaning: '观察，看',
							examples: [
								{
									word: 'microscope',
									ipa: '/ˈmaɪkrəskəʊp/',
									pos: 'n.',
									translationZh: '显微镜',
								},
								{
									word: 'telescope',
									ipa: '/tˈeləskˌəʊp/',
									pos: 'n.',
									translationZh: '望远镜',
								},
								{
									word: 'periscope',
									ipa: '/pˈerəskˌəʊp/',
									pos: 'n.',
									translationZh: '潜望镜',
								},
								{
									word: 'endoscope',
									ipa: '/ˈendəʊskˌəʊp/',
									pos: 'n.',
									translationZh: '内窥镜',
								},
							],
						},
						{
							root: 'soph',
							meaning: '智慧',
							examples: [
								{
									word: 'philosophy',
									ipa: '/fəlˈɑːsəfiː/',
									pos: 'n.',
									translationZh: '哲学',
								},
								{
									word: 'sophisticated',
									ipa: '/səfˈɪstəkˌeɪtɪd/',
									pos: 'adj.',
									translationZh: '复杂的',
								},
								{
									word: 'sophomore',
									ipa: '/sˈɑːfmˌɔːr/',
									pos: 'n.',
									translationZh: '大二学生',
								},
							],
						},
						{
							root: 'techn',
							meaning: '技术，艺术',
							examples: [
								{
									word: 'technology',
									ipa: '/teknˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '技术',
								},
								{
									word: 'technical',
									ipa: '/tˈeknɪkəl/',
									pos: 'adj.',
									translationZh: '技术的',
								},
								{
									word: 'technique',
									ipa: '/teknˈiːk/',
									pos: 'n.',
									translationZh: '技巧',
								},
							],
						},
						{
							root: 'tele',
							meaning: '远',
							examples: [
								{
									word: 'telephone',
									ipa: '/tˈeləfˌəʊn/',
									pos: 'n.',
									translationZh: '电话',
								},
								{
									word: 'television',
									ipa: '/tˈeləvˌɪʒən/',
									pos: 'n.',
									translationZh: '电视',
								},
								{
									word: 'telescope',
									ipa: '/tˈeləskˌəʊp/',
									pos: 'n.',
									translationZh: '望远镜',
								},
								{
									word: 'teleport',
									ipa: '/tˈeləpˈɔːrt/',
									pos: 'n.',
									translationZh: '传送',
								},
							],
						},
						{
							root: 'the/theo',
							meaning: '神',
							examples: [
								{
									word: 'theology',
									ipa: '/θiːˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '神学',
								},
								{
									word: 'theist',
									ipa: '/ˈθiːɪst/',
									pos: 'n.',
									translationZh: '有神论者',
								},
								{
									word: 'atheist',
									ipa: '/ˈeɪθiɪst/',
									pos: 'n.',
									translationZh: '无神论者',
								},
								{
									word: 'monotheism',
									ipa: '/mˈɑːnəθˌiːɪzəm/',
									pos: 'n.',
									translationZh: '一神论',
								},
							],
						},
						{
							root: 'therm',
							meaning: '热',
							examples: [
								{
									word: 'thermometer',
									ipa: '/θəmˈɑːmətə/',
									pos: 'n.',
									translationZh: '温度计',
								},
								{
									word: 'thermal',
									ipa: '/θˈɜːməl/',
									pos: 'n.',
									translationZh: '热的',
								},
								{
									word: 'thermos',
									ipa: '/θˈɜːməs/',
									pos: 'n.',
									translationZh: '保温瓶',
								},
							],
						},
						{
							root: 'tom',
							meaning: '切',
							examples: [
								{
									word: 'atom',
									ipa: '/ˈætəm/',
									pos: 'n.',
									translationZh: '原子',
								},
								{
									word: 'anatomy',
									ipa: '/ənˈætəmiː/',
									pos: 'n.',
									translationZh: '解剖',
								},
								{
									word: 'epitome',
									ipa: '/ɪpˈɪtəmiː/',
									pos: 'n.',
									translationZh: '缩影',
								},
								{
									word: 'tome',
									ipa: '/tˈəʊm/',
									pos: 'n.',
									translationZh: '大册书',
								},
							],
						},
						{
							root: 'tox',
							meaning: '毒',
							examples: [
								{
									word: 'toxic',
									ipa: '/tˈɑːksɪk/',
									pos: 'adj.',
									translationZh: '有毒的',
								},
								{
									word: 'toxin',
									ipa: '/tˈɑːksən/',
									pos: 'n.',
									translationZh: '毒素',
								},
								{
									word: 'intoxication',
									ipa: '/ˌɪntˌɑːksəkˈeɪʃən/',
									pos: 'n.',
									translationZh: '中毒',
								},
								{
									word: 'detox',
									ipa: '/dˈiːtˌɑːks/',
									pos: 'n.',
									translationZh: '排毒',
								},
							],
						},
						{
							root: 'typ',
							meaning: '类型，模式',
							examples: [
								{
									word: 'type',
									ipa: '/tˈaɪp/',
									pos: 'n.',
									translationZh: '类型',
								},
								{
									word: 'typical',
									ipa: '/tˈɪpəkəl/',
									pos: 'adj.',
									translationZh: '典型的',
								},
								{
									word: 'prototype',
									ipa: '/prˈəʊtəʊtˌaɪp/',
									pos: 'n.',
									translationZh: '原型',
								},
								{
									word: 'typography',
									ipa: '/təpˈɑːɡrəfiː/',
									pos: 'n.',
									translationZh: '排版',
								},
							],
						},
						{
							root: 'xeno',
							meaning: '外国，陌生',
							examples: [
								{
									word: 'xenophobia',
									ipa: '/zˌenəfˈəʊbiːə/',
									pos: 'n.',
									translationZh: '仇外',
								},
								{
									word: 'xenograft',
									ipa: '/ˈzenəʊɡrɑːft/',
									pos: 'n.',
									translationZh: '异种移植',
								},
							],
						},
						{
							root: 'zo',
							meaning: '动物',
							examples: [
								{
									word: 'zoo',
									ipa: '/zˈuː/',
									pos: 'n.',
									translationZh: '动物园',
								},
								{
									word: 'zoology',
									ipa: '/zəʊˈɑːlədʒiː/',
									pos: 'n.',
									translationZh: '动物学',
								},
								{
									word: 'protozoa',
									ipa: '/prˌəʊtəzˈəʊə/',
									pos: 'n.',
									translationZh: '原生动物',
								},
								{
									word: 'zooplankton',
									ipa: '/ˈzuːəplæŋktən/',
									pos: 'n.',
									translationZh: '浮游动物',
								},
							],
						},
					],
				},
				{
					name: '盎格鲁-撒克逊词根 (Anglo-Saxon Roots)',
					items: [
						{
							root: 'after-',
							meaning: '在...之后',
							examples: [
								{
									word: 'afternoon',
									ipa: '/ˌæftənˈuːn/',
									pos: 'n.',
									translationZh: '下午',
								},
								{
									word: 'afterward',
									ipa: '/ˈæftəwəd/',
									pos: 'adv.',
									translationZh: '后来',
								},
								{
									word: 'aftermath',
									ipa: '/ˈæftəmˌæθ/',
									pos: 'n.',
									translationZh: '后果',
								},
							],
						},
						{
							root: 'be-',
							meaning: '使，加以',
							examples: [
								{
									word: 'befriend',
									ipa: '/bɪfrˈend/',
									pos: 'n.',
									translationZh: '以友相待',
								},
								{
									word: 'belittle',
									ipa: '/bɪlˈɪtəl/',
									pos: 'n.',
									translationZh: '轻视',
								},
								{
									word: 'bewilder',
									ipa: '/bɪwˈɪldə/',
									pos: 'n.',
									translationZh: '使迷惑',
								},
							],
						},
						{
							root: 'fore-',
							meaning: '前，预先',
							examples: [
								{
									word: 'forehead',
									ipa: '/ˈfɒrɪd/',
									pos: 'n.',
									translationZh: '前额',
								},
								{
									word: 'forecast',
									ipa: '/ˈfɔːkɑːst/',
									pos: 'n.',
									translationZh: '预报',
								},
								{
									word: 'foresee',
									ipa: '/fɔːˈsiː/',
									pos: 'n.',
									translationZh: '预见',
								},
							],
						},
						{
							root: 'mid-',
							meaning: '中间',
							examples: [
								{
									word: 'midday',
									ipa: '/ˈmɪddeɪ/',
									pos: 'adj.',
									translationZh: '中午',
								},
								{
									word: 'midnight',
									ipa: '/ˈmɪdnaɪt/',
									pos: 'n.',
									translationZh: '午夜',
								},
								{
									word: 'midsummer',
									ipa: '/mɪdˈsʌmə/',
									pos: 'n.',
									translationZh: '仲夏',
								},
							],
						},
						{
							root: 'mis-',
							meaning: '错误，坏',
							examples: [
								{
									word: 'mistake',
									ipa: '/mɪˈsteɪk/',
									pos: 'n.',
									translationZh: '错误',
								},
								{
									word: 'misunderstand',
									ipa: '/ˌmɪsʌndəˈstænd/',
									pos: 'n.',
									translationZh: '误解',
								},
								{
									word: 'mislead',
									ipa: '/mɪsˈliːd/',
									pos: 'n.',
									translationZh: '误导',
								},
							],
						},
						{
							root: 'over-',
							meaning: '上，超过',
							examples: [
								{
									word: 'overhead',
									ipa: '/ˈəʊvəhed/',
									pos: 'n.',
									translationZh: '头顶上',
								},
								{
									word: 'overcome',
									ipa: '/ˌəʊvəˈkʌm/',
									pos: 'n.',
									translationZh: '克服',
								},
								{
									word: 'overtime',
									ipa: '/ˈəʊvətˌaɪm/',
									pos: 'n.',
									translationZh: '加班',
								},
							],
						},
						{
							root: 'under-',
							meaning: '下，不足',
							examples: [
								{
									word: 'underground',
									ipa: '/ˈʌndəɡraʊnd/',
									pos: 'n.',
									translationZh: '地下',
								},
								{
									word: 'underwater',
									ipa: '/ˈʌndəwˌɔːtə/',
									pos: 'n.',
									translationZh: '水下',
								},
								{
									word: 'underestimate',
									ipa: '/ˈʌndəˈestəmˌeɪt/',
									pos: 'v.',
									translationZh: '低估',
								},
							],
						},
						{
							root: 'up-',
							meaning: '上，向上',
							examples: [
								{
									word: 'upgrade',
									ipa: '/əpɡrˈeɪd/',
									pos: 'n.',
									translationZh: '升级',
								},
								{
									word: 'uphold',
									ipa: '/əphˈəʊld/',
									pos: 'n.',
									translationZh: '维护',
								},
								{
									word: 'upset',
									ipa: '/əpsˈet/',
									pos: 'n.',
									translationZh: '打乱',
								},
							],
						},
						{
							root: 'with-',
							meaning: '向后，相反',
							examples: [
								{
									word: 'withdraw',
									ipa: '/wɪðdrˈɔː/',
									pos: 'n.',
									translationZh: '撤回',
								},
								{
									word: 'withhold',
									ipa: '/wɪθhˈəʊld/',
									pos: 'n.',
									translationZh: '保留',
								},
								{
									word: 'withstand',
									ipa: '/wɪθstˈænd/',
									pos: 'n.',
									translationZh: '抵抗',
								},
							],
						},
					],
				},
			],
		},
	},
} as {
	grammar: GrammarReference;
	morphology: MorphologyReference;
};
