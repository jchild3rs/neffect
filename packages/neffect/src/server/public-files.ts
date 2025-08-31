import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";

export class PublicFilesMap extends Context.Tag("PublicFilesMap")<
	PublicFilesMap,
	Record<string, string>
>() {}

export const PublicFilesMapLive = Layer.effect(
	PublicFilesMap,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const { publicDir } = yield* ProvidedBuildConfig;

		if (!(yield* fs.exists(`${process.cwd()}/${publicDir}`))) {
			return {};
		}

		const publicFiles = yield* fs.readDirectory(
			`${process.cwd()}/${publicDir}`,
			{},
		);

		return publicFiles.reduce<Record<string, string>>((acc, file) => {
			acc[file] = file;
			return acc;
		}, {});
	}),
);
