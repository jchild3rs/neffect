import { useCallback, useContext } from "react";
import type { Manifest } from "../types.ts";
import { routeLoading } from "./route-store.ts";
import { RouterContext } from "./router-context.ts";

export function useNavigation() {
	const routeContext = useContext(RouterContext);

	if (!routeContext) {
		throw new Error(
			"useNavigation must be used within a RouterContext.Provider",
		);
	}

	const navigate = useCallback(
		(path: string) => {
			const maybeSearch = path.includes("?") ? path.split("?")[1] : "";

			if (maybeSearch) {
				const searchParams = new URLSearchParams(maybeSearch);
				routeContext.query.value = Object.fromEntries(searchParams.entries());
			}

			const state = { pathPattern: routeContext.pathPattern };
			window.history.pushState(state, "", path);
			window.dispatchEvent(new PopStateEvent("popstate", { state }));
			routeLoading.value = true;
		},
		[routeContext],
	);

	const handleClick = useCallback(async (e: MouseEvent) => {
		if (e.defaultPrevented) return;
		if (e.button !== 0) return;
		if (e.metaKey || e.ctrlKey || e.altKey) return;

		const target = e.target as HTMLElement;
		if (!target) return;

		const anchor = e.currentTarget as HTMLAnchorElement;
		if (!anchor) return;

		const href = anchor.href;
		if (!href) return;

		if (
			href === location.pathname + location.search ? `?${location.search}` : ""
		) {
			e.preventDefault();
			return;
		}

		e.preventDefault();

		const routeManifest: Manifest = JSON.parse(
			document.getElementById("manifest")?.textContent || "{}",
		);

		const root = document.getElementById("root");

		for (const route of Object.values(routeManifest)) {
			if (route.type === "asset") continue;

			const pattern = new URLPattern({
				pathname: route.pathPattern as string,
				baseURL: location.origin,
			});

			const match = pattern.exec(href, location.origin);

			if (match && root) {
				navigate(href);
			}
		}
	}, []);

	return {
		navigate,
		handleClick,
	};
}
