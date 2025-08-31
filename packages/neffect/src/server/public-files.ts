import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";

export class PublicFilesMap extends Context.Tag("PublicFilesMap")<
	PublicFilesMap,
	Record<string, string>
>() {}

export const PublicFilesMapLive = Layer.effect(
	PublicFilesMap,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		if (!(yield* fs.exists(`${process.cwd()}/public`))) {
			return {};
		}

		const publicFiles = yield* fs.readDirectory(`${process.cwd()}/public`, {});
		return publicFiles.reduce<Record<string, string>>((acc, file) => {
			acc[file] = file;
			return acc;
		}, {});
	}),
);
