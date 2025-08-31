import * as fs from "node:fs";
import {
	cpSync,
	existsSync,
	globSync,
	mkdirSync,
	writeFileSync,
} from "node:fs";
import * as path from "node:path";
import { zstdCompressSync } from "node:zlib";
import postcss, { type AcceptedPlugin } from "postcss";
import type { Plugin, RolldownOptions } from "rolldown";
import esbuild from "rollup-plugin-esbuild";
import {
	assetBaseUrlFallback,
	outDirFallback,
	publicDirFallback,
	routeDirFallback,
} from "./server/config.ts";
import type { BuildConfig, Manifest } from "./types.ts";

export function definePluginConfig(
	config?: BuildConfig | null,
): RolldownOptions[] {
	const rootDir = config?.rootDir ?? "src";
	const routeDir = config?.routeDir ?? routeDirFallback;
	const routePaths = globSync([`${rootDir}/${routeDir}/**/*.tsx`], {
		cwd: process.cwd(),
	});
	const outDir = config?.outDir ?? outDirFallback;

	const rolldownOptions = config?.rolldownOptions ?? {};

	const routeEntries = routePaths.reduce<Record<string, string>>(
		(acc, path) => {
			const key = path.replace(`${rootDir}/`, "").replace(".tsx", "");
			acc[key] = path;
			return acc;
		},
		{},
	);

	if (fs.existsSync(path.join(process.cwd(), "src/router.tsx"))) {
		routeEntries.router = `${process.cwd()}/src/router.tsx`;
	}

	const routeLoadPaths = globSync([`${rootDir}/${routeDir}/**/*.data.ts`], {
		cwd: process.cwd(),
	});
	const routeLoadEntries = routeLoadPaths.reduce<Record<string, string>>(
		(acc, path) => {
			const key = path.replace(`${rootDir}/`, "").replace(".ts", "");
			acc[key] = path;
			return acc;
		},
		{},
	);

	const cssPaths = globSync(`${rootDir}/**/*.css`, { cwd: process.cwd() });

	const cssEntries = cssPaths.reduce<Record<string, string>>((acc, path) => {
		const key = path.replace(`${rootDir}/`, "").replace(".css", "");
		acc[key] = path;
		return acc;
	}, {});

	const sharedOptions = {
		...rolldownOptions,
		input: {
			"base/_app": `${import.meta.dirname}/server/_app.tsx`,
			"base/_document": `${import.meta.dirname}/server/_document.tsx`,
		},
		cwd: process.cwd(),
		plugins: [manifestPlugin(), esbuild({ loaders: { svg: "dataurl" } })],
		resolve: {
			...rolldownOptions?.resolve,
			alias: {
				...rolldownOptions?.resolve?.alias,
				react: "preact/compat",
				"react-dom/test-utils": "preact/test-utils",
				"react-dom": "preact/compat",
				"react/jsx-runtime": "preact/jsx-runtime",
				"neffect/link": `${import.meta.dirname}/router/link.tsx`,
				"neffect/app-config": `${import.meta.dirname}/app-config.ts`,
				"neffect/server": `${import.meta.dirname}/server/server.ts`,
				"neffect/use-*": `${import.meta.dirname}/router/use-*.ts`,
				"neffect/document": `${import.meta.dirname}/server/_document.tsx`,
				"neffect/app": `${import.meta.dirname}/server/_app.tsx`,
				"neffect/server/$(.*)": `${import.meta.dirname}/server/$1.ts`,
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
					baseUrl: config?.assetBaseUrl ?? assetBaseUrlFallback,
					fileName: "importmap.json",
				},
				incrementalBuild: true,
				strictExecutionOrder: true,
			},
			input: {
				main: `${import.meta.dirname}/entry-client.tsx`,
				...cssEntries,
				...routeEntries,
				...sharedOptions.input,
			},
			output: {
				dir: `${outDir}/client`,
			},
			platform: "browser",
			plugins: [
				...sharedOptions.plugins,
				postcssPlugin(outDir, config?.minifyCss, config?.postcssPlugins),
				...(config?.compress ? [compressionPlugin()] : [undefined]),
				copyPublicFolder(config?.publicDir),
			],
		},
		{
			...sharedOptions,
			input: {
				main: `${import.meta.dirname}/entry-server.tsx`,
				...routeEntries,
				...routeLoadEntries,
				...sharedOptions.input,
			},
			output: {
				dir: `${outDir}/server`,
			},
			platform: "node",
		},
	];
}

function postcssPlugin(
	outDir: string,
	_minify?: boolean,
	providedPlugins: AcceptedPlugin[] = [],
): Plugin {
	return {
		name: "postcss",
		async transform(code, id) {
			if (id.endsWith(".css")) {
				const path = `${process.cwd()}/${outDir}/client${id}`;
				const result = await postcss([...providedPlugins]).process(code, {
					from: path,
					to: path,
				});

				if (result) {
					return result.css;
				}
			}

			return code;
		},
	};
}

function manifestPlugin() {
	return {
		name: "write-manifest-json",
		generateBundle(options, bundle) {
			const manifest: Manifest = {};
			const outDir = `${process.cwd()}/${options.dir ?? "build"}`;

			for (const [_key, entry] of Object.entries(bundle)) {
				manifest[entry.fileName] = {
					type: entry.type,
					file: entry.fileName,
					name: entry.name as string,
				};
			}

			if (!existsSync(outDir)) {
				mkdirSync(outDir, { recursive: true });
			}
			writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest));
		},
	} satisfies Plugin;
}

function copyPublicFolder(publicDir = publicDirFallback) {
	return {
		name: "copy-public-folder",
		writeBundle(options) {
			const outDir = options.dir ?? "build";
			if (existsSync(`${process.cwd()}/${publicDir}`)) {
				cpSync(
					`${process.cwd()}/${publicDir}`,
					`${process.cwd()}/${outDir}/${publicDir}`,
					{
						recursive: true,
					},
				);
			}
		},
	} satisfies Plugin;
}

const compressionPlugin = () =>
	({
		name: "compression",
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
	}) satisfies Plugin;
