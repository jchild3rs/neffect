import "urlpattern-polyfill";
import { randomBytes } from "node:crypto";
import { HttpServerResponse } from "@effect/platform";
import { NodeHttpClient } from "@effect/platform-node";
import { signal } from "@preact/signals";
import { Chunk, Data, Effect, Stream } from "effect";
import { renderToReadableStream } from "preact-render-to-string/stream";
import type { RouterContext } from "./router/router-context.ts";
import { DocumentHead, DocumentScripts } from "./server/_document.tsx";
import type { ImportMapJSON } from "./server/import-map.ts";
import type {
	Manifest,
	ManifestChunk,
	Metadata,
	RouteDataModule,
	RouteModule,
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
	console.log(error);
	return Effect.fail(new StreamRenderError(error));
};

export const handle = (
	routeCssEntry: ManifestChunk,
	manifest: Manifest,
	importMap: ImportMapJSON,
	route: ManifestChunk,
	params: Record<string, string | undefined>,
	query: Record<string, string | string[] | undefined>,
) =>
	Effect.gen(function* () {
		const routeModule = yield* Effect.promise<RouteModule>(
			() => import(`${import.meta.dirname}/${route.file}`),
		);

		const routeDataModule = yield* Effect.promise<RouteDataModule>(
			() =>
				import(
					`${import.meta.dirname}/${route.file.replace(".js", ".data.js")}`
				),
		).pipe(Effect.catchAll(() => Effect.succeed(null)));

		const nonce = randomBytes(16).toString("base64");

		const Page = routeModule.default;

		let data: Record<string, unknown> = {};
		if (typeof routeDataModule?.load === "function") {
			data = yield* routeDataModule.load();
		}

		let metadata: Metadata = {
			title: "Default Title",
		};

		if (typeof routeDataModule?.metadata === "function") {
			metadata = yield* routeDataModule.metadata();
		}

		const pageProps = {
			data,
			query,
			params,
		};

		const routeContext: RouterContext = {
			query: signal(query),
			params: signal(params),
			pathPattern: route.pathPattern || "/",
		};

		const BaseDocument = yield* Effect.tryPromise(() =>
			import(`${process.cwd()}/dist/server/base/_document.js`).then(
				(mod) => mod.default,
			),
		).pipe(Effect.catchTags({ UnknownException: () => Effect.succeed(null) }));

		// We will *swap* if provided
		const ProvidedDocument = yield* Effect.tryPromise(() =>
			import(`${process.cwd()}/dist/server/pages/_document.js`).then(
				(mod) => mod.default,
			),
		).pipe(Effect.catchTags({ UnknownException: () => Effect.succeed(null) }));

		const BaseApp = yield* Effect.tryPromise(() =>
			import(`${process.cwd()}/dist/server/base/_app.js`).then(
				(mod) => mod.default,
			),
		).pipe(Effect.catchTags({ UnknownException: () => Effect.succeed(null) }));

		// Will be a *child* of BaseApp if provided
		const ProvidedApp = yield* Effect.tryPromise(
			() =>
				import(`${process.cwd()}/dist/server/pages/_app.js`).then((mod) => {
					return mod.default;
				}) as Promise<typeof BaseApp>,
		).pipe(
			Effect.catchTags({
				UnknownException: () => Effect.succeed(null),
			}),
		);

		return yield* HttpServerResponse.stream(
			Stream.concat(
				Stream.fromChunk(DOCTYPE_HTML_CHUNK),
				Stream.fromReadableStream({
					evaluate: () => {
						const body = ProvidedApp ? (
							<BaseApp routeContext={routeContext}>
								<ProvidedApp routeContext={routeContext}>
									<Page {...pageProps} />
								</ProvidedApp>
							</BaseApp>
						) : (
							<BaseApp routeContext={routeContext}>
								<Page {...pageProps} />
							</BaseApp>
						);

						const head = (
							<DocumentHead routeCssEntry={routeCssEntry}>
								<title>{metadata.title}</title>
							</DocumentHead>
						);

						const scripts = (
							<DocumentScripts
								nonce={nonce}
								routeCssEntry={routeCssEntry}
								routeManifest={manifest}
								route={route}
								routeData={data}
								routeContext={routeContext}
								hasProvidedApp={Boolean(ProvidedApp)}
								body={body}
								head={head}
								importMap={importMap}
							/>
						);

						const document = ProvidedDocument ? (
							<ProvidedDocument
								head={head}
								body={
									ProvidedApp ? (
										<BaseApp routeContext={routeContext}>
											<ProvidedApp routeContext={routeContext}>
												<Page {...pageProps} />
											</ProvidedApp>
										</BaseApp>
									) : (
										<BaseApp routeContext={routeContext}>
											<Page {...pageProps} />
										</BaseApp>
									)
								}
								scripts={scripts}
							/>
						) : (
							<BaseDocument
								nonce={nonce}
								routeCssEntry={routeCssEntry}
								routeManifest={manifest}
								route={route}
								routeData={data}
								routeContext={routeContext}
								hasProvidedApp={Boolean(ProvidedApp)}
								body={
									ProvidedApp ? (
										<BaseApp routeContext={routeContext}>
											<ProvidedApp routeContext={routeContext}>
												<Page {...pageProps} />
											</ProvidedApp>
										</BaseApp>
									) : (
										<BaseApp routeContext={routeContext}>
											<Page {...pageProps} />
										</BaseApp>
									)
								}
								head={head}
								importMap={importMap}
							/>
						);

						return renderToReadableStream(document);
					},
					onError: onStreamError,
				}),
			),
			{
				contentType: "text/html",
				headers: {
					// "Content-Security-Policy": `script-src 'nonce-${nonce}'`,
				},
			},
		);
	}).pipe(Effect.provide(NodeHttpClient.layerUndici));

export type Handler = typeof handle;
