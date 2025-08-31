import type { FunctionComponent, PropsWithChildren } from "react";
import {
	type RouterContext,
	RouterProvider,
} from "../router/router-context.tsx";

export type AppProps = PropsWithChildren<{ routeContext: RouterContext }>;

export type AppComponent = FunctionComponent<AppProps>;

export default function App(
	props: PropsWithChildren<{ routeContext: RouterContext }>,
) {
	return (
		<RouterProvider value={props.routeContext}>{props.children}</RouterProvider>
	);
}
