import { Effect } from "effect";

export const load = () =>
	Effect.gen(function* () {
		yield* Effect.promise(
			() => new Promise((resolve) => setTimeout(resolve, 200)),
		);

		return {
			title: "Blog",
			description: "Welcome to the Blog Page",
		};
	});

export type PageData = Effect.Effect.Success<ReturnType<typeof load>>;

export const metadata = (
	data: Effect.Effect.Success<ReturnType<typeof load>>,
) => Effect.succeed({ title: data.title });
