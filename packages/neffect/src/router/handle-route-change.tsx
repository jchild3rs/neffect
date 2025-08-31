import { render } from "preact/compat";
import type { FunctionComponent, PropsWithChildren } from "react";
import type { Manifest } from "../types.ts";
import { routeLoading } from "./route-store.ts";
import type { RouterContext } from "./router-context.tsx";

// To avoid race conditions
let navToken = 0;

export async function handleRouteChange(
	routeContext: RouterContext,
	_state: unknown,
) {
	const currentNavToken = ++navToken;
	const BaseApp = await import("../server/_app.tsx").then((mod) => mod.default);

	let ProvidedApp: FunctionComponent<PropsWithChildren> | null = null;
	try {
		if (window.__hasProvidedApp) {
			ProvidedApp = await import(
				(`/_assets/${window.__routeDir}/_app.js`)
			).then((mod) => mod.default);
		}
	} catch (_e) {
		ProvidedApp = null;
	}

	const searchParams = new URLSearchParams(window.location.search);
	routeContext.query.value = Object.fromEntries(searchParams.entries());

	const routeManifest: Manifest = JSON.parse(
		document.getElementById("manifest")?.textContent || "{}",
	);

	for (const route of Object.values(routeManifest)) {
		if (route.type === "asset") continue;
		const pattern = new URLPattern({
			pathname: route.pathPattern as string,
			baseURL: location.origin,
		});

		const match = pattern.exec(location.pathname, location.origin);
		if (!match) continue;

		const root = document.getElementById("root");
		if (root) {
			routeContext.params.value = match.pathname.groups;

			const Page = await import(`/_assets/${route.file}`).then(
				(mod) => mod.default,
			);

			const loadKey = route.file.replace(".js", ".json");
			const loadUrl = new URL(window.location.href);
			loadUrl.pathname = `/load/${loadKey}`;

			const data =
				window.__loadCache[loadUrl.href] ??
				(await fetch(loadUrl.href).then((mod) => mod.json()));

			window.__loadCache[loadUrl.href] = data;

			const cssRoutePath = route.file
				.replace(".js", ".css")
				.replace(`${window.__routeDir}/`, "/");

			const asset = routeManifest[cssRoutePath];
			const cssLink = document.getElementById(
				"route-css",
			) as HTMLLinkElement | null;
			if (asset) {
				const newCssLinkHref = `/_assets/${route.file.replace(".js", ".css")}`;
				if (cssLink && !cssLink.href.endsWith(newCssLinkHref)) {
					cssLink.href = newCssLinkHref;
				}
			} else if (cssLink?.href) {
				cssLink.href = "";
			}

			if (currentNavToken !== navToken) return;

			const app = ProvidedApp ? (
				<BaseApp routeContext={routeContext}>
					<ProvidedApp>
						<Page
							data={data}
							query={routeContext.query}
							params={match.pathname.groups}
						/>
					</ProvidedApp>
				</BaseApp>
			) : (
				<BaseApp routeContext={routeContext}>
					<Page
						data={data}
						query={routeContext.query}
						params={match.pathname.groups}
					/>
				</BaseApp>
			);

			render(app, root, () => {
				routeLoading.value = false;
			});

			break;
		}
	}
}
