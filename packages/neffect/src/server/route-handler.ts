import { Context, Effect, Layer } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";
import type { Handler } from "../entry-server.tsx";

export class RouteHandler extends Context.Tag("RouteHandler")<
	RouteHandler,
	Handler
>() {}

export const RouteHandlerLive = Layer.effect(
	RouteHandler,
	ProvidedBuildConfig.pipe(
		Effect.flatMap((buildConfig) =>
			Effect.promise(() =>
				import(`${process.cwd()}/${buildConfig.outDir}/server/main.js`).then(
					(mod) => mod.handle as Handler,
				),
			),
		),
	),
);
