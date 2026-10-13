import { about } from './about';
import { account } from './account';
import { auth } from './auth';
import { chat } from './chat';
import { coding } from './coding';
import { common } from './common';
import { components } from './components';
import { download } from './download';
import { ebook } from './ebook';
import { englishLearning } from './englishLearning';
import { home } from './home';
import { knowledge } from './knowledge';
import { pay } from './pay';
import { plugins } from './plugins';
import { profile } from './profile';
import { route } from './route';
import { setting } from './setting';
import { share } from './share';
import { skill } from './skill';

export const zhCN = {
	...common,
	...components,
	...route,
	...home,
	...auth,
	...account,
	...profile,
	...chat,
	...knowledge,
	...ebook,
	...englishLearning,
	...setting,
	...pay,
	...plugins,
	...skill,
	...coding,
	...share,
	...about,
	...download,
};
