import {
	existsSync,
	globSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { transform } from "lightningcss";
import type { Plugin, RolldownOptions } from "rolldown";
import esbuild from "rollup-plugin-esbuild";
import type { Manifest } from "../types.ts";

const isProduction = process.env.NODE_ENV === "production";

interface BuildConfig {
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
	 * Compress and serve the output files with gzip
	 *
	 * @since 0.1.0
	 */
	gzipCompress?: boolean;

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
}

const cssMinifyPlugin: Plugin = {
	name: "css-minify",
	async writeBundle(options, bundle) {
		for (const [id, entry] of Object.entries(bundle)) {
			if (entry.type === "asset" && id.endsWith(".css")) {
				const result = transform({
					filename: id,
					code: Buffer.from(entry.source),
					minify: true,
				});
				writeFileSync(`${options.dir}/${id}`, result.code);
			}
		}
	},
};

const manifestPlugin: Plugin = {
	name: "write-manifest-json",
	generateBundle(options, bundle) {
		const manifest: Manifest = {};
		const outDir = `${process.cwd()}/${options.dir ?? "dist"}`;

		if (existsSync(outDir)) {
			rmSync(outDir, { recursive: true });
		}

		mkdirSync(outDir, { recursive: true });

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

const gzipPlugin: Plugin = {
	name: "gzip",
	async writeBundle(options, bundle) {
		for (const [fileName, file] of Object.entries(bundle)) {
			if (fileName.endsWith(".json")) continue;
			const source = file.type === "asset" ? file.source : file.code;
			const compressed = gzipSync(source, { level: 9 });

			const path = `${options.dir}/compressed/${fileName}`;
			const pathWithoutFile = path.split("/").slice(0, -1).join("/");
			mkdirSync(pathWithoutFile, { recursive: true });
			writeFileSync(`${options.dir}/compressed/${fileName}`, compressed);
		}
	},
};

export function defineConfig(config?: BuildConfig): RolldownOptions[] {
	const routePaths = globSync(["src/pages/**/*.tsx", "src/pages/**/*.tsx"], {
		cwd: process.cwd(),
	});

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
		input: {
			"base/_app": "src/lib/server/_app.tsx",
			"base/_document": "src/lib/server/_document.tsx",
		},
		cwd: process.cwd(),
		plugins: [manifestPlugin, esbuild({ loaders: { svg: "dataurl" } })],
		resolve: {
			alias: {
				react: "preact/compat",
				"react-dom/test-utils": "preact/test-utils",
				"react-dom": "preact/compat",
				"react/jsx-runtime": "preact/jsx-runtime",
			},
		},
		transform: {
			jsx: {
				runtime: "automatic",
				importSource: "preact",
			},
		},
	} satisfies RolldownOptions;

	console.log({ routeLoadEntries });
	const options: RolldownOptions[] = [
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
				main: "src/lib/entry-client.tsx",
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
				...(isProduction || config?.minifyCss ? [cssMinifyPlugin] : []),
				...(config?.gzipCompress ? [gzipPlugin] : [undefined]),
			],
		},
		{
			...sharedOptions,
			input: {
				main: "src/lib/entry-server.tsx",
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

	if (config?.rolldownOptions) {
		options.push(config.rolldownOptions);
	}

	return options;
}
