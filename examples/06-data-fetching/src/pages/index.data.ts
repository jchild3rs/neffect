import { Effect } from "effect";

const payload = Array.from({ length: 500 }).map(() => Math.random());

export const load = () =>
	Effect.gen(function* () {
		yield* Effect.promise(
			() => new Promise((resolve) => setTimeout(resolve, 100)),
		);

		return {
			some: "data-that-took-100ms",
			payload,
		};
	});

export type PageData = Effect.Effect.Success<ReturnType<typeof load>>;

export const metadata = () =>
	Effect.succeed({
		title: "Home",
		description: "Welcome to the Preact App",
	});
