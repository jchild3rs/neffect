import { Context, Effect, Layer } from "effect";

export type ImportMapJSON = {
	imports: Record<string, string>;
};

export class ImportMap extends Context.Tag("ImportMap")<
	ImportMap,
	ImportMapJSON
>() {}

const getImportMap = Effect.promise(() =>
	import(`${process.cwd()}/dist/client/importmap.json`, {
		with: { type: "json" },
	}).then((mod) => mod.default),
);
export const ImportMapLive = Layer.effect(ImportMap, getImportMap);
