import { Effect } from "effect";

export const load = () =>
	Effect.gen(function* () {
		const posts = yield* Effect.promise(() =>
			fetch("https://jsonplaceholder.typicode.com/posts").then((res) =>
				res.json(),
			),
		);

		return { posts } as const;
	});

export type PageData = Effect.Effect.Success<ReturnType<typeof load>>;

export const metadata = () =>
	Effect.succeed({
		title: "Home",
		description: "Welcome to the Preact App",
	});
