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
import { serverPortConfig } from "./config.ts";
import { ImportMapLive } from "./import-map.ts";
import {
	ClientManifestLive,
	RouteManifestLive,
	ServerManifestLive,
} from "./manifests.ts";
import { PublicFilesMapLive } from "./public-files.ts";
import { RouteHandlerLive } from "./route-handler.ts";
import { RouteMiddleware } from "./route-middleware.ts";
import { StaticAssetsLive, StaticAssetsMiddleware } from "./static-assets.ts";
import { NodeSdkLive } from "./tracing.ts";
import { UuidLive } from "./uuid.ts";

const router = HttpRouter.empty.pipe(
	StaticAssetsMiddleware,
	RouteMiddleware,
	HttpMiddleware.xForwardedHeaders,
	Effect.catchTags({
		RouteNotFound: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const html = yield* fs.readFileString(
					`${process.cwd()}/src/pages/404.html`,
				);

				return HttpServerResponse.text(html, {
					contentType: "text/html",
					status: 404,
				});
			}),
	}),
	Effect.catchAllCause((cause) => {
		return Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			let html = yield* fs.readFileString(
				`${process.cwd()}/src/pages/500.html`,
			);

			// todo if is dev...
			html = html.replace("<!--stack-->", cause.toString());

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
);

export const server: Layer.Layer<
	never,
	PlatformError | ConfigError.ConfigError | ServeError
> = router.pipe(
	Layer.provide(
		Layer.unwrapEffect(
			Effect.gen(function* () {
				const port = yield* serverPortConfig;

				return NodeHttpServer.layer(() => createServer(), { port });
			}),
		),
	),
	Layer.provide(NodeSdkLive),
	Layer.provide(NodeContext.layer),
);

// Storing in memory here – so there's no _actual_ async
// behavior when importing these during routing.
export const warmUpServerImports = Effect.gen(function* () {
	const manifest = yield* Effect.promise(() =>
		import(`${process.cwd()}/dist/server/manifest.json`, {
			with: { type: "json" },
		}).then((mod) => mod.default),
	);
	const importPaths = Object.keys(manifest)
		.filter((path) => path.endsWith(".js"))
		.map((path) => `${process.cwd()}/dist/server/${path}`);
	yield* Effect.all(
		importPaths.map((path) => Effect.promise(() => import(path))),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(warmUpServerImports);
	NodeRuntime.runMain(Layer.launch(server));
}
