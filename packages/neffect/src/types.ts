import type { Effect } from "effect";
import type { FunctionComponent } from "react";

export type ManifestChunk = {
	type: "chunk";
	file: string;
	name?: string;
	pathPattern?: string;
	pattern?: URLPattern;
};

export type AssetChunk = {
	type: "asset";
	file: string;
	name?: string;
};

export type Manifest = {
	[key: string]: ManifestChunk | AssetChunk;
};

export type Metadata = {
	title: string;
	// TODO flesh the rest out
	description?: string;
	keywords?: string[];
	robots?: string;
	canonical?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogUrl?: string;
};

export type RouteComponent = FunctionComponent<{
	params: Record<string, string | undefined>;
	query: Record<string, string | string[] | undefined>;
	data: Record<string, unknown>;
}>;

export type RouteModule = {
	default: RouteComponent;
};

export type RouteDataModule<
	LoadData extends Record<string, unknown> = Record<string, unknown>,
> = {
	load?: () => Effect.Effect<LoadData, never, never>;
	metadata?: (
		data: Effect.Effect.Success<
			ReturnType<NonNullable<RouteDataModule<LoadData>["load"]>>
		>,
	) => Effect.Effect<Metadata, never, never>;
};
