import type { Signal } from "@preact/signals";
import { createContext, type PropsWithChildren, useEffect } from "react";
import { handleRouteChange } from "./handle-route-change.tsx";

export type RouterContext<Params = Record<string, string | undefined>> = {
	params: Signal<Params>;
	query: Signal<Record<string, string | string[] | undefined>>;
	pathPattern: string;
};
export const RouterContext = createContext<RouterContext>({} as never);

export function RouterProvider({
	children,
	value,
}: PropsWithChildren<{ value: RouterContext }>) {
	useEffect(() => {
		window.onpopstate = (e: PopStateEvent) => {
			void handleRouteChange(value, e.state);
		};
	}, [value.params.value, value.query.value]);

	return (
		<RouterContext.Provider value={value}>{children}</RouterContext.Provider>
	);
}
