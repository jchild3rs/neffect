import type { PropsWithChildren } from "react";
import {
	type RouterContext,
	RouterProvider,
} from "../router/router-context.tsx";

export default function App(
	props: PropsWithChildren<{ routeContext: RouterContext }>,
) {
	return (
		<RouterProvider value={props.routeContext}>{props.children}</RouterProvider>
	);
}
