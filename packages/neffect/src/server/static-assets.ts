import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";

export class StaticAssets extends Context.Tag("StaticAssets")<
	StaticAssets,
	Record<string, string>
>() {}

export const StaticAssetsLive = Layer.effect(
	StaticAssets,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const { outDir } = yield* ProvidedBuildConfig;

		const files = yield* fs.readDirectory(`${process.cwd()}/${outDir}/client`, {
			recursive: true,
		});

		return files.reduce<Record<string, string>>((acc, file) => {
			const path = file.split("/").slice(1).join("/");
			acc[path] = file;
			return acc;
		}, {});
	}),
);
