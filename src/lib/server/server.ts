import { createServer } from "node:http";
import {
	HttpMiddleware,
	HttpRouter,
	HttpServer,
	HttpServerResponse,
} from "@effect/platform";
import {
	NodeContext,
	NodeHttpServer,
	NodeRuntime,
} from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { serverPortConfig } from "./config.ts";
import { ImportMapLive } from "./import-map.ts";
import {
	ClientManifestLive,
	RouteManifestLive,
	ServerManifestLive,
} from "./manifests.ts";
import { RouteHandlerLive } from "./route-handler.ts";
import { RouteMiddleware } from "./route-middleware.ts";
import { StaticAssetsLive, StaticAssetsMiddleware } from "./static-assets.ts";
import { UuidLive } from "./uuid.ts";

const router = HttpRouter.empty.pipe(
	StaticAssetsMiddleware,
	RouteMiddleware,
	HttpMiddleware.xForwardedHeaders,
	Effect.catchTags({
		RouteNotFound: () => HttpServerResponse.text("Not found", { status: 404 }),
	}),
	Effect.catchAllCause((cause) => {
		return HttpServerResponse.text(cause.toString(), { status: 500 });
	}),
	HttpServer.serve(),
	HttpServer.withLogAddress,
	Layer.provide(StaticAssetsLive),
	Layer.provide(RouteManifestLive),
	Layer.provide(ServerManifestLive),
	Layer.provide(ClientManifestLive),
	Layer.provide(RouteHandlerLive),
	Layer.provide(ImportMapLive),
	Layer.provide(UuidLive),
);

// if (import.meta.main) {
NodeRuntime.runMain(
	Layer.launch(
		router.pipe(
			Layer.provide(
				Layer.unwrapEffect(
					Effect.gen(function* () {
						const port = yield* serverPortConfig;

						return NodeHttpServer.layer(() => createServer(), { port });
					}),
				),
			),
			Layer.provide(NodeContext.layer),
		),
	),
);
// }
