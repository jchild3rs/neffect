import type { Effect } from 'effect';
import type { AcceptedPlugin } from 'postcss';
import type { FunctionComponent } from 'react';
import type { RolldownOptions } from 'rolldown';

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

export interface BuildConfig {
	/**
	 * The base URL to use for serving static assets
	 *
	 * @since 0.1.0
	 * @default /_assets/
	 * @example
	 * ```ts
	 * defineConfig({
	 *   assetBaseUrl: "https://cdn.example.com/assets/"
	 * })
	 * ```
	 */
	assetBaseUrl?: `${'/' | `${string}://`}${string}/`;

	/**
	 * Compress and serve the output files with ZStandard
	 *
	 * @since 0.1.0
	 */
	compress?: boolean;

	/**
	 * The global stylesheet to use for all pages
	 *
	 * @default "styles.css"
	 * @since 0.1.0
	 */
	globalStylesheet?: `${string}.css`;

	/**
	 * Minify the output of CSS files
	 *
	 * @since 0.1.0
	 */
	minifyCss?: boolean;

	/**
	 * Output directory for the build
	 *
	 * @default "build"
	 * @since 0.1.0
	 */
	outDir?: string;

	/**
	 * PostCSS plugin list
	 *
	 * @since 0.1.0
	 */
	postcssPlugins?: AcceptedPlugin[];

	/**
	 * @default "public"
	 * @since 0.1.0
	 */
	publicDir?: string;

	/**
	 * Additional build options (rolldown)
	 *
	 * @since 0.1.0
	 */
	rolldownOptions?: RolldownOptions;

	/**
	 * @default "src"
	 * @since 0.1.0
	 */
	rootDir?: string;

	/**
	 * Output directory for the build
	 *
	 * @default "pages"
	 * @since 0.1.0
	 */
	routeDir?: string;
}
