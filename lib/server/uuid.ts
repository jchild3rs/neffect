import { Context, Effect, Layer } from "effect";
import { v7 } from "uuid";

export class Uuid extends Context.Tag("Uuid")<
	Uuid,
	{ generate: Effect.Effect<string> }
>() {}

export const UuidLive = Layer.effect(
	Uuid,
	Effect.succeed({
		generate: Effect.sync(() => v7()),
	}),
);
