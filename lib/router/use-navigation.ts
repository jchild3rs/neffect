import { useCallback, useContext } from "react";
import type { Manifest } from "../types.ts";
import { routeLoading } from "./route-store.ts";
import { RouterContext } from "./router-context.tsx";

export function useNavigation() {
	const routeContext = useContext(RouterContext);

	if (!routeContext) {
		throw new Error(
			"useNavigation must be used within a RouterContext.Provider",
		);
	}

	const navigate = useCallback(
		(path: string) => {
			const nextUrl = new URL(path, location.href);

			// Keep query in context in sync
			routeContext.query.value = Object.fromEntries(
				nextUrl.searchParams.entries(),
			);

			// Optionally could also sync hash if you expose it in context

			// Set loading before history/state change to avoid flash
			routeLoading.value = true;

			const state = {
				pathPattern: routeContext.pathPattern,
				href: nextUrl.href,
			};
			window.history.pushState(state, "", nextUrl.href);
			window.dispatchEvent(new PopStateEvent("popstate", { state }));
		},
		[routeContext],
	);

	const handleClick = useCallback(
		(e: MouseEvent) => {
			// Ignore default-prevented, non-left click, or with modifier keys
			if (e.defaultPrevented) return;
			if ((e as MouseEvent).button !== 0) return;
			if (
				(e as MouseEvent).metaKey ||
				(e as MouseEvent).ctrlKey ||
				(e as MouseEvent).altKey ||
				(e as MouseEvent).shiftKey
			)
				return;

			const anchor = e.currentTarget as HTMLAnchorElement | null;
			if (!anchor) return;

			// Respect target and download
			if (anchor.target && anchor.target.toLowerCase() !== "_self") return;
			if (anchor.hasAttribute("download")) return;

			const href = anchor.href;
			if (!href) return;

			// Only same-origin interception
			const destUrl = new URL(href, location.href);
			if (destUrl.origin !== location.origin) return;

			// If navigating to the exact same URL (including search/hash), do nothing
			const currentUrl = new URL(location.href);
			if (destUrl.href === currentUrl.href) {
				e.preventDefault();
				return;
			}

			// Intercept
			e.preventDefault();

			const routeManifest: Manifest = JSON.parse(
				document.getElementById("manifest")?.textContent || "{}",
			);

			for (const route of Object.values(routeManifest)) {
				if (route.type === "asset") continue;

				const pattern = new URLPattern({
					pathname: route.pathPattern as string,
					baseURL: location.origin,
				});

				const match = pattern.exec(destUrl.href, location.origin);

				if (match) {
					navigate(destUrl.href);
					// Important: avoid multiple navigations if multiple routes match
					break;
				}
			}
		},
		[navigate],
	);

	return {
		navigate,
		handleClick,
	};
}
