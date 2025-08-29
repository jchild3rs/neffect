import {
	cpSync,
	existsSync,
	globSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { zstdCompressSync } from "node:zlib";
import { transform } from "lightningcss";
import type { Plugin, RolldownOptions } from "rolldown";
import esbuild from "rollup-plugin-esbuild";
import type { Manifest } from "./types.ts";

const isProduction = process.env.NODE_ENV === "production";

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
			rmSync(outDir, { recursive: true, force: true });
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

const copyPublicFolder: Plugin = {
	name: "copy-public-folder",
	writeBundle() {
		cpSync(`${process.cwd()}/public`, `${process.cwd()}/dist/client/public`, {
			recursive: true,
		});
	},
};

const gzipPlugin: Plugin = {
	name: "gzip",
	async writeBundle(options, bundle) {
		for (const [fileName, file] of Object.entries(bundle)) {
			if (fileName.endsWith(".json")) continue;
			const source = file.type === "asset" ? file.source : file.code;
			// zStandard level 12
			// const compressed = gzipSync(source, { level: 9 });
			const compressed = zstdCompressSync(source, {});
			// const stream = createZstdCompress({
			// 	params: {
			// 		[zlib.constants.ZSTD_c_strategy]: zlib.constants.ZSTD_btultra,
			// 	},
			// });
			//
			// stream.write(source);
			// stream.end();
			//

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
			"base/_app": "neffect/app",
			"base/_document": "neffect/document",
		},
		cwd: process.cwd(),
		plugins: [manifestPlugin, esbuild({ loaders: { svg: "dataurl" } })],
		resolve: {
			alias: {
				react: "preact/compat",
				"react-dom/test-utils": "preact/test-utils",
				"react-dom": "preact/compat",
				"react/jsx-runtime": "preact/jsx-runtime",
				"neffect/link": `${process.cwd()}/lib/router/link.tsx`,
				"neffect/server": `${process.cwd()}/lib/router/server.ts`,
				"neffect/use-*": `${process.cwd()}/lib/router/use-*.ts`,
				"neffect/document": `${process.cwd()}/lib/server/_document.tsx`,
				"neffect/app": `${process.cwd()}/lib/server/_app.tsx`,
				"neffect/server/$(.*)": `${process.cwd()}/lib/server/$1.ts`,
			},
		},
		transform: {
			jsx: {
				runtime: "automatic",
				importSource: "preact",
			},
		},
	} satisfies RolldownOptions;

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
				...(isProduction || config?.minifyCss ? [cssMinifyPlugin] : []),
				...(config?.compress ? [gzipPlugin] : [undefined]),
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

	if (config?.rolldownOptions) {
		options.push(config.rolldownOptions);
	}

	return options;
}
