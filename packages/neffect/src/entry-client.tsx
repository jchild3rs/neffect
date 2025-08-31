import { signal } from "@preact/signals";
import type { FunctionComponent, PropsWithChildren } from "react";
import { hydrate } from "react";

declare global {
	interface Window {
		__hasProvidedApp: boolean;
		__loadCache: Record<string, unknown>;
	}
}

async function mount() {
	if (!("URLPattern" in globalThis)) {
		await import("urlpattern-polyfill");
	}

	const BaseApp = await import("./server/_app.tsx").then((mod) => mod.default);

	let ProvidedApp: FunctionComponent<PropsWithChildren> | null = null;
	try {
		if (window.__hasProvidedApp) {
			ProvidedApp = await import(
				// @ts-expect-error
				"/_assets/pages/_app.js"
			).then((mod) => mod.default);
		}
	} catch (_e) {
		ProvidedApp = null;
	}

	const root = document.getElementById("root");
	if (root) {
		const routeData = JSON.parse(
			document.getElementById("route-data")?.textContent || "{}",
		);
		const routeLoadData = JSON.parse(
			document.getElementById("load-result")?.textContent || "{}",
		);
		const Page = await import(routeData.fileImport).then((mod) => mod.default);

		const routeContext = {
			...routeData.routeContext,
			params: signal(routeData.routeContext.params),
			query: signal(routeData.routeContext.query),
		};

		if (ProvidedApp) {
			hydrate(
				<BaseApp routeContext={routeContext}>
					<ProvidedApp>
						<Page
							data={routeLoadData}
							query={routeData.routeContext.query}
							params={routeData.routeContext.params}
						/>
					</ProvidedApp>
				</BaseApp>,
				root,
			);
		} else {
			hydrate(
				<BaseApp routeContext={routeContext}>
					<Page
						data={routeLoadData}
						query={routeData.routeContext.query}
						params={routeData.routeContext.params}
					/>
				</BaseApp>,
				root,
			);
		}
	}
}

void mount();

window.__loadCache = {};
