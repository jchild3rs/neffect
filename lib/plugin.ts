import {
	cpSync,
	existsSync,
	globSync,
	mkdirSync,
	writeFileSync,
} from 'node:fs';
import { zstdCompressSync } from 'node:zlib';
import postcss, { type AcceptedPlugin } from 'postcss';
import type { Plugin, RolldownOptions } from 'rolldown';
import esbuild from 'rollup-plugin-esbuild';
import type { Manifest } from './types.ts';

export interface BuildConfig {
	/**
	 * The global stylesheet to use for all pages
	 *
	 * @default styles.css
	 * @since 0.1.0
	 */
	globalStylesheet?: `${string}.css`;

	/**
	 * Additional build options (rolldown)
	 *
	 * @since 0.1.0
	 */
	rolldownOptions?: RolldownOptions;

	/**
	 * Compress and serve the output files with ZStandard
	 *
	 * @since 0.1.0
	 */
	compress?: boolean;

	/**
	 * Minify the output of CSS files
	 *
	 * @since 0.1.0
	 */
	minifyCss?: boolean;

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
	assetBaseUrl?: string;

	/**
	 * PostCSS plugin list
	 *
	 * @since 0.1.0
	 */
	postcssPlugins?: AcceptedPlugin[];
}

const postcssPlugin = (
	minify?: boolean,
	providedPlugins: AcceptedPlugin[] = [],
): Plugin => ({
	name: "postcss",
	async writeBundle(options, bundle) {
		for (const [id, entry] of Object.entries(bundle)) {
			if (entry.type === "asset" && id.endsWith(".css")) {
				const path = `${options.dir}/${id}`;

				const plugins: AcceptedPlugin[] = [
					...providedPlugins,
					await import("@tailwindcss/postcss").then((mod) => mod.default()),
					...(minify
						? [
								await import("cssnano").then((mod) =>
									mod.default({ preset: "default" }),
								),
							]
						: []),
				];

				const result = await postcss(plugins).process(entry.source.toString(), {
					from: path,
					to: path,
				});
				writeFileSync(path, result.css);
			}
		}
	},
});

const manifestPlugin: Plugin = {
	name: "write-manifest-json",
	generateBundle(options, bundle) {
		const manifest: Manifest = {};
		const outDir = `${process.cwd()}/${options.dir ?? "dist"}`;

		for (const [_key, entry] of Object.entries(bundle)) {
			manifest[entry.fileName] = {
				type: entry.type,
				file: entry.fileName,
				name: entry.name as string,
			};
		}

		writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest));
	},
};

const copyPublicFolder: Plugin = {
	name: "copy-public-folder",
	writeBundle() {
		if (existsSync(`${process.cwd()}/public`)) {
			cpSync(`${process.cwd()}/public`, `${process.cwd()}/dist/client/public`, {
				recursive: true,
			});
		}
	},
};

const gzipPlugin: Plugin = {
	name: "gzip",
	async writeBundle(options, bundle) {
		for (const [fileName, file] of Object.entries(bundle)) {
			if (fileName.endsWith(".json")) continue;
			const source = file.type === "asset" ? file.source : file.code;
			const compressed = zstdCompressSync(Buffer.from(source));

			const path = `${options.dir}/compressed/${fileName}`;
			const pathWithoutFile = path.split("/").slice(0, -1).join("/");
			mkdirSync(pathWithoutFile, { recursive: true });
			writeFileSync(`${options.dir}/compressed/${fileName}`, compressed);
		}
	},
};

export function definePluginConfig(
	config?: BuildConfig | null,
): RolldownOptions[] {
	const routePaths = globSync(["src/pages/**/*.tsx"], {
		cwd: process.cwd(),
	});

	const rolldownOptions = config?.rolldownOptions ?? {};

	const routeEntries = routePaths.reduce<Record<string, string>>(
		(acc, path) => {
			const key = path.replace("src/", "").replace(".tsx", "");
			acc[key] = path;
			return acc;
		},
		{},
	);

	const routeLoadPaths = globSync(["src/pages/**/*.data.ts"], {
		cwd: process.cwd(),
	});
	const routeLoadEntries = routeLoadPaths.reduce<Record<string, string>>(
		(acc, path) => {
			const key = path.replace("src/", "").replace(".ts", "");
			acc[key] = path;
			return acc;
		},
		{},
	);

	const cssPaths = globSync("src/**/*.css", { cwd: process.cwd() });

	const cssEntries = cssPaths.reduce<Record<string, string>>((acc, path) => {
		const key = path.replace("src/", "").replace(".css", "");
		acc[key] = path;
		return acc;
	}, {});

	const sharedOptions = {
		...rolldownOptions,
		input: {
			"base/_app": "neffect/app",
			"base/_document": "neffect/document",
		},
		cwd: process.cwd(),
		plugins: [manifestPlugin, esbuild({ loaders: { svg: "dataurl" } })],
		resolve: {
			...rolldownOptions?.resolve,
			alias: {
				...rolldownOptions?.resolve?.alias,
				react: "preact/compat",
				"react-dom/test-utils": "preact/test-utils",
				"react-dom": "preact/compat",
				"react/jsx-runtime": "preact/jsx-runtime",
				"neffect/link": `${process.cwd()}/lib/router/link.tsx`,
				"neffect/server": `${process.cwd()}/lib/server/server.ts`,
				"neffect/use-*": `${process.cwd()}/lib/router/use-*.ts`,
				"neffect/document": `${process.cwd()}/lib/server/_document.tsx`,
				"neffect/app": `${process.cwd()}/lib/server/_app.tsx`,
				"neffect/server/$(.*)": `${process.cwd()}/lib/server/$1.ts`,
			},
		},
		transform: {
			...rolldownOptions?.transform,
			jsx: {
				runtime: "automatic",
				importSource: "preact",
			},
		},
	} satisfies RolldownOptions;

	return [
		{
			...sharedOptions,
			experimental: {
				chunkImportMap: {
					baseUrl: "/_assets/",
					fileName: "importmap.json",
				},
				incrementalBuild: true,
				strictExecutionOrder: true,
			},
			input: {
				main: "lib/entry-client.tsx",
				styles: "src/styles.css",
				...cssEntries,
				...routeEntries,
				...sharedOptions.input,
			},
			output: {
				dir: "dist/client",
			},
			platform: "browser",
			plugins: [
				...sharedOptions.plugins,
				...(config?.compress ? [gzipPlugin] : [undefined]),
				postcssPlugin(config?.minifyCss, config?.postcssPlugins),
				copyPublicFolder,
			],
		},
		{
			...sharedOptions,
			input: {
				main: "lib/entry-server.tsx",
				...routeEntries,
				...routeLoadEntries,
				...sharedOptions.input,
			},
			output: {
				dir: "dist/server",
			},
			platform: "node",
		},
	];
}
