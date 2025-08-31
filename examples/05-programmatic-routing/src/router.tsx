import {
	HttpMiddleware,
	HttpRouter,
	HttpServerRequest,
	HttpServerResponse,
} from "@effect/platform";
import { Effect } from "effect";
import { ProvidedBuildConfig } from "neffect/app-config";
import { HttpJSXServerResponse } from "neffect/external-router";

export const middleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		console.log("LOGGED", request.url);
		return yield* app;
	}),
);

export const router = HttpRouter.empty.pipe(
	HttpRouter.get(
		"/",
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;

			yield* Effect.log("Handling `/`");
			const buildConfig = yield* ProvidedBuildConfig;

			return HttpJSXServerResponse({
				head: <title>Home</title>,
				body: <h1>Home</h1>,
				buildConfig,
				request,
				params: {},
			});
		}),
	),
	HttpRouter.get("/api/data", HttpServerResponse.json({ some: "data" })),
);

export default router;
