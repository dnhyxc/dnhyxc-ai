import { Toaster } from '@ui/sonner';
import { createBrowserRouter, RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from './routes';

const App = () => {
	const router = createBrowserRouter(routes as RouteObject[]);
	return (
		<div className="h-full w-full bg-theme-background">
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};

export default App;
