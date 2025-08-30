import "urlpattern-polyfill";
import { randomBytes } from "node:crypto";
import { HttpServerResponse } from "@effect/platform";
import { NodeHttpClient } from "@effect/platform-node";
import { signal } from "@preact/signals";
import { Chunk, Data, Effect, Option, Stream } from "effect";
import type { FunctionComponent } from "preact";
import { renderToReadableStream } from "preact-render-to-string/stream";
import type { RouterContext } from "./router/router-context.tsx";
import type { AppComponent } from "./server/_app.tsx";
import {
	type DocumentComponent,
	DocumentHead,
	DocumentScripts,
} from "./server/_document.tsx";
import type { ImportMapJSON } from "./server/import-map.ts";
import type {
	Manifest,
	ManifestChunk,
	Metadata,
	RouteComponent,
	RouteDataModule,
} from "./types.ts";

class StreamRenderError extends Data.TaggedError("StreamRenderError") {
	cause: unknown;

	constructor(_cause: unknown) {
		super();
		this.cause = _cause;
	}
}

const DOCTYPE_HTML_CHUNK = Chunk.of(
	new TextEncoder().encode("<!DOCTYPE html>"),
);

const onStreamError = (error: unknown) => {
	console.error(error);
	return Effect.fail(new StreamRenderError(error));
};

const loadModule = <T,>(
	path: string,
	returnDefault?: boolean,
): Effect.Effect<T> =>
	Effect.promise(() =>
		import(
			`${process.cwd()}/dist/server/${path.startsWith("/") ? "" : "/"}${path}`
		).then((mod) => {
			if (returnDefault) {
				return mod.default;
			}
			return mod;
		}),
	);

const tryLoadModule = <T,>(path: string, returnDefault?: boolean) =>
	Effect.tryPromise({
		try: () =>
			import(
				`${process.cwd()}/dist/server/${path.startsWith("/") ? "" : "/"}${path}`
			).then((mod) => {
				if (returnDefault) {
					return Option.some(mod.default as T);
				}
				return Option.some(mod as T);
			}),
		catch: () => Option.none(),
	});

const getPageData = (path: string) =>
	tryLoadModule<RouteDataModule>(path.replace(".js", ".data.js")).pipe(
		Effect.flatMap((routeDataModule) =>
			Effect.gen(function* () {
				let data: Record<string, unknown> = {};
				let metadata: Metadata = {
					title: "Default Title",
				};

				if (Option.isSome(routeDataModule)) {
					if (typeof routeDataModule.value.load === "function") {
						data = yield* routeDataModule.value.load();
					}

					if (typeof routeDataModule.value.metadata === "function") {
						metadata = yield* routeDataModule.value.metadata(data);
					}
				}

				return { data, metadata } as const;
			}),
		),
	);

export const handle = ({
	routeCssEntry,
	routeManifest,
	importMap,
	route,
	params,
	query,
}: {
	routeCssEntry: ManifestChunk;
	routeManifest: Manifest;
	importMap: ImportMapJSON;
	route: ManifestChunk;
	params: Record<string, string | undefined>;
	query: Record<string, string | string[] | undefined>;
}) =>
	Effect.gen(function* () {
		const Page = yield* loadModule<RouteComponent>(route.file, true);
		const { data, metadata } = yield* getPageData(route.file);
		const pageProps = { data, query, params };

		const routeContext: RouterContext = {
			query: signal(query),
			params: signal(params),
			pathPattern: route.pathPattern || "/",
		};

		const BaseDocument = yield* loadModule<DocumentComponent>(
			"/base/_document.js",
			true,
		);

		const BaseApp = yield* loadModule<AppComponent>("/base/_app.js", true);

		const Document = Option.getOrElse(
			yield* tryLoadModule<DocumentComponent>(`/pages/_document.js`, true),
			() => BaseDocument,
		);

		const App = yield* tryLoadModule<FunctionComponent>(`/pages/_app.js`, true);

		const nonce = randomBytes(16).toString("base64");
		const head = (
			<DocumentHead routeCssEntry={routeCssEntry}>
				<title>{metadata.title}</title>
			</DocumentHead>
		);

		const scripts = (
			<DocumentScripts
				nonce={nonce}
				routeCssEntry={routeCssEntry}
				routeManifest={routeManifest}
				route={route}
				routeData={data}
				routeContext={routeContext}
				hasProvidedApp={Boolean(App)}
				importMap={importMap}
			/>
		);

		const body = (
			<BaseApp routeContext={routeContext}>
				{App._tag === "Some" ? (
					<App.value>
						<Page {...pageProps} />
					</App.value>
				) : (
					<Page {...pageProps} />
				)}
			</BaseApp>
		);

		const document = (
			<Document
				nonce={nonce}
				routeCssEntry={routeCssEntry}
				routeManifest={routeManifest}
				route={route}
				routeData={data}
				routeContext={routeContext}
				hasProvidedApp={App._tag === "Some"}
				body={body}
				head={head}
				scripts={scripts}
				importMap={importMap}
			/>
		);

		return yield* HttpServerResponse.stream(
			Stream.concat(
				Stream.fromChunk(DOCTYPE_HTML_CHUNK),
				Stream.fromReadableStream({
					evaluate: () => renderToReadableStream(document),
					onError: onStreamError,
				}),
			),
			{
				contentType: "text/html",
				headers: {
					"Content-Security-Policy": `script-src 'nonce-${nonce}'`,
				},
			},
		);
	}).pipe(Effect.provide(NodeHttpClient.layerUndici));

export type Handler = typeof handle;
