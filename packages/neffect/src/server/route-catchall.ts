import {
	FileSystem,
	HttpRouter,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { RouteNotFound } from "@effect/platform/HttpServerError";
import { Effect } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";
import type { ManifestChunk, RouteDataModule } from "../types.ts";
import { isProduction } from "./config.ts";
import {
	ClientManifest,
	getClientManifest,
	getRouteManifest,
	RouteManifest,
} from "./manifests.ts";
import { PublicFilesMap } from "./public-files.ts";
import { RouteHandler } from "./route-handler.ts";
import { Uuid } from "./uuid.ts";

export const RouteCatchAll = HttpRouter.all(
	"*",
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const isProd = yield* isProduction;
		const uuid = yield* Uuid;
		const buildConfig = yield* ProvidedBuildConfig;
		const publicFilesMap = yield* PublicFilesMap;
		const fs = yield* FileSystem.FileSystem;
		const { assetBaseUrl, outDir, publicDir } = yield* ProvidedBuildConfig;

		if (request.url.includes(assetBaseUrl)) {
			const hasCompressed = yield* fs.exists(
				`${process.cwd()}/${outDir}/client/compressed`,
			);
			const acceptEncoding = request.headers["accept-encoding"] || "";
			const responseHeaders: Record<string, string> = {};
			const isCompressed = hasCompressed && acceptEncoding.includes("zstd");
			const path = request.url.split(assetBaseUrl)[1];
			if (isCompressed) {
				responseHeaders["Content-Encoding"] = "zstd";

				return yield* HttpServerResponse.file(
					`${process.cwd()}/${outDir}/client/${isCompressed ? "compressed/" : ""}${path}`,
					{ headers: responseHeaders },
				);
			}

			return yield* HttpServerResponse.file(
				`${process.cwd()}/${outDir}/client/${path}`,
			);
		}

		const pathParts = request.url.split("/").filter(Boolean);
		const lastPart = pathParts[pathParts.length - 1];

		if (publicFilesMap[lastPart]) {
			return yield* HttpServerResponse.file(
				`${process.cwd()}/${outDir}/client/${publicDir}/${lastPart}`,
			);
		}

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
						`${process.cwd()}/${buildConfig.outDir}/server${modPath.replace(".json", ".data.js")}`
					) as Promise<RouteDataModule>,
			);

			if (typeof mod.load !== "function") {
				return yield* Effect.fail(new RouteNotFound({ request }));
			}

			const data = yield* mod.load();

			return HttpServerResponse.unsafeJson(data, { headers: responseHeaders });
		}

		const staticMatch = routeManifest[request.url]
		if (staticMatch && staticMatch.type !== "asset") {
			const route = staticMatch
			const routeHandler = yield* RouteHandler;
			const importMap = yield* Effect.promise(() =>
				import(
					`${process.cwd()}/${buildConfig.outDir}/client/importmap.json${
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

			const params = {}

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

		for (const route of Object.values(routeManifest)) {
			if (route.type === "asset") continue;


			const match = route.pattern?.exec(request.url);
			if (match) {
				const routeHandler = yield* RouteHandler;
				const importMap = yield* Effect.promise(() =>
					import(
						`${process.cwd()}/${buildConfig.outDir}/client/importmap.json${
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

		return yield* Effect.fail(new RouteNotFound({ request }));
	}),
);
