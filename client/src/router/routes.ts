import Layout from '@/layout';
import Home from '@/views/home';
import About from '@/views/about';

const routes = [
  {
    Component: Layout,
    children: [
      {
        index: true,
        Component: Home
      },
      {
        path: 'about',
        Component: About
      }
    ]
  }
];

export default routes;
