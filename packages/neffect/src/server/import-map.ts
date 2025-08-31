import { Context, Effect, Layer } from "effect";
import { ProvidedBuildConfig } from "../app-config.ts";

export type ImportMapJSON = {
	imports: Record<string, string>;
};

export class ImportMap extends Context.Tag("ImportMap")<
	ImportMap,
	ImportMapJSON
>() {}

export const getImportMap = ProvidedBuildConfig.pipe(
	Effect.flatMap((buildConfig) =>
		Effect.promise(() =>
			import(`${process.cwd()}/${buildConfig.outDir}/client/importmap.json`, {
				with: { type: "json" },
			}).then((mod) => mod.default),
		),
	),
);

export const ImportMapLive = Layer.effect(ImportMap, getImportMap);
