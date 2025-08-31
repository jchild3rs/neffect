import { createServer } from "node:http";
import {
	FileSystem,
	HttpMiddleware,
	HttpRouter,
	HttpServer,
	HttpServerResponse,
} from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import type { ServeError } from "@effect/platform/HttpServerError";
import {
	NodeContext,
	NodeHttpServer,
	NodeRuntime,
} from "@effect/platform-node";
import { type ConfigError, Effect, Layer } from "effect";
import { ProvidedBuildConfig, ProvidedBuildConfigLive } from "../app-config.ts";
import { serverPortConfig } from "./config.ts";
import { ImportMapLive } from "./import-map.ts";
import {
	ClientManifestLive,
	RouteManifestLive,
	ServerManifestLive,
} from "./manifests.ts";
import { PublicFilesMapLive } from "./public-files.ts";
import { RouteCatchAll } from "./route-catchall.ts";
import { RouteHandlerLive } from "./route-handler.ts";
import { StaticAssetsLive } from "./static-assets.ts";
import { NodeSdkLive } from "./tracing.ts";
import { UuidLive } from "./uuid.ts";

const AssetBaseUrlToken = "%ASSET_BASE_URL%" as const;

const NotFoundHTML = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const { assetBaseUrl, routeDir, rootDir } = yield* ProvidedBuildConfig;

	return yield* fs
		.readFileString(`${process.cwd()}/${rootDir}/${routeDir}/404.html`)
		.pipe(
			Effect.catchTags({
				SystemError: () => fs.readFileString(`${import.meta.dirname}/404.html`),
			}),
			Effect.map((str) => str.replace(AssetBaseUrlToken, assetBaseUrl)),
		);
});

const InternalServerErrorHTML = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const { assetBaseUrl, routeDir, rootDir } = yield* ProvidedBuildConfig;

	return yield* fs
		.readFileString(`${process.cwd()}/${rootDir}/${routeDir}/500.html`)
		.pipe(
			Effect.catchTags({
				SystemError: () => fs.readFileString(`${import.meta.dirname}/500.html`),
			}),
			Effect.map((str) => str.replace(AssetBaseUrlToken, assetBaseUrl)),
		);
});

const baseRouter = HttpRouter.empty.pipe(
	HttpRouter.get("/healthz", HttpServerResponse.text("OK")),
	RouteCatchAll,
);

// let providedRouter = HttpRouter.empty;
// try {
// 	providedRouter = await import(`${process.cwd()}/build/server/router.js`).then(
// 		(mod) => mod.default as HttpRouter.HttpRouter,
// 	);
// } catch (error: unknown) {
// 	if (
// 		(
// 			error as {
// 				code: string;
// 			}
// 		).code !== "ERR_MODULE_NOT_FOUND"
// 	) {
// 		console.error(error);
// 	}
// }

const defaultMiddleware = HttpMiddleware.make((app) => app);

const { providedRouter, middleware } = await Effect.runPromise(
	Effect.promise(() =>
		import(`${process.cwd()}/build/server/router.js`).then((mod) => ({
			providedRouter: mod.default as HttpRouter.HttpRouter,
			middleware: mod.middleware as typeof defaultMiddleware,
		})),
	).pipe(
		Effect.catchAllCause(() =>
			Effect.succeed({
				providedRouter: HttpRouter.empty,
				middleware: defaultMiddleware,
			}),
		),
	),
);

const router = HttpRouter.concat(baseRouter, providedRouter);

const HttpServerLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const port = yield* serverPortConfig;

		return NodeHttpServer.layer(() => createServer(), { port });
	}),
);

export const server: Layer.Layer<
	never,
	PlatformError | ConfigError.ConfigError | ServeError
> = router.pipe(
	middleware,
	HttpMiddleware.xForwardedHeaders,
	Effect.catchTags({
		RouteNotFound: () =>
			NotFoundHTML.pipe(
				Effect.map((html) =>
					HttpServerResponse.text(html, {
						contentType: "text/html",
						status: 404,
					}),
				),
			),
	}),
	Effect.catchAllCause((cause) => {
		return Effect.gen(function* () {
			yield* Effect.logError(cause);

			let html = yield* InternalServerErrorHTML;

			if (process.env.NODE_ENV !== "production") {
				html = html.replace("<!--stack-->", cause.toString());
			}

			return HttpServerResponse.text(html, {
				contentType: "text/html",
				status: 500,
			});
		});
	}),
	HttpServer.serve(),
	HttpServer.withLogAddress,
	Layer.provide(StaticAssetsLive),
	Layer.provide(RouteManifestLive),
	Layer.provide(ServerManifestLive),
	Layer.provide(PublicFilesMapLive),
	Layer.provide(ClientManifestLive),
	Layer.provide(RouteHandlerLive),
	Layer.provide(ImportMapLive),
	Layer.provide(UuidLive),
	Layer.provide(HttpServerLive),
	Layer.provide(ProvidedBuildConfigLive),
	Layer.provide(NodeSdkLive),
	Layer.provide(NodeContext.layer),
);

// Storing in memory here – so there's no _actual_ async
// behavior when importing these during routing.
export const warmUpServerImports = Effect.gen(function* () {
	const buildConfig = yield* ProvidedBuildConfig;
	const manifest = yield* Effect.promise(() =>
		import(`${process.cwd()}/${buildConfig.outDir}/server/manifest.json`, {
			with: { type: "json" },
		}).then((mod) => mod.default),
	);
	const importPaths = Object.keys(manifest)
		.filter((path) => path.endsWith(".js"))
		.map((path) => `${process.cwd()}/${buildConfig.outDir}/server/${path}`);
	yield* Effect.all(
		importPaths.map((path) => Effect.promise(() => import(path))),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		warmUpServerImports.pipe(Effect.provide(ProvidedBuildConfigLive)),
	);
	NodeRuntime.runMain(Layer.launch(server));
}
