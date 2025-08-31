import { Context, Effect, Layer } from "effect";
import type { Handler } from "../entry-server.tsx";

export class RouteHandler extends Context.Tag("RouteHandler")<
	RouteHandler,
	Handler
>() {}

export const RouteHandlerLive = Layer.effect(
	RouteHandler,
	Effect.promise(() =>
		import(`${process.cwd()}/build/server/main.js`).then(
			(mod) => mod.handle as Handler,
		),
	),
);
