import {
	HttpMiddleware,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { RouteNotFound } from "@effect/platform/HttpServerError";
import { Effect } from "effect";
import type { ManifestChunk, RouteDataModule } from "../types.ts";
import { isProduction } from "./config.ts";
import {
	ClientManifest,
	getClientManifest,
	getRouteManifest,
	RouteManifest,
} from "./manifests.ts";
import { RouteHandler } from "./route-handler.ts";
import { Uuid } from "./uuid.ts";

export const RouteMiddleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const uuid = yield* Uuid;

		const responseHeaders: Record<string, string> = {
			"X-Request-Id": yield* uuid.generate,
		};

		// These conditions are because in "dev mode", we want to
		// always load the latest built assets.
		// (When we use the layer, it's a singleton)
		const routeManifest = isProduction
			? yield* RouteManifest
			: yield* getRouteManifest;

		const clientManifest = isProduction
			? yield* ClientManifest
			: yield* getClientManifest;

		// Helper route for loading route data client side
		if (request.url.startsWith("/load")) {
			const modPath = request.url.split("/load")[1];
			const mod = yield* Effect.promise(
				() =>
					import(
						`${process.cwd()}/build/server${modPath.replace(".json", ".data.js")}`
					) as Promise<RouteDataModule>,
			);

			if (typeof mod.load !== "function") {
				return yield* Effect.fail(new RouteNotFound({ request }));
			}

			const data = yield* mod.load();

			return HttpServerResponse.unsafeJson(data, { headers: responseHeaders });
		}

		const isProd = yield* isProduction;
		for (const route of Object.values(routeManifest)) {
			if (route.type === "asset") continue;

			const match = route.pattern?.exec(request.url);
			if (match) {
				const routeHandler = yield* RouteHandler;
				const importMap = yield* Effect.promise(() =>
					import(
						`${process.cwd()}/build/client/importmap.json${
							isProd
								? ""
								: // this is a module cache bust for dev mode
									`?${Math.random()}`
						}`,
						{
							with: { type: "json" },
						}
					).then((mod) => mod.default),
				);

				const urlSearchParams = new URLSearchParams(
					request.url.split("?")[1] ?? "",
				);
				const query: Record<string, string | string[] | undefined> = {};

				for (const [key, value] of urlSearchParams.entries()) {
					if (query[key]) {
						query[key] = Array.isArray(query[key])
							? [...query[key], value]
							: [query[key], value];
					} else {
						query[key] = value;
					}
				}

				const params = match.pathname.groups;

				const routeCssEntry = clientManifest[
					`${route.name}.css`
				] as ManifestChunk;

				return yield* routeHandler({
					routeCssEntry,
					routeManifest,
					importMap,
					route,
					params,
					query,
				});
			}
		}

		return yield* app;
	}),
);
