import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export const NodeSdkLive = NodeSdk.layer(() => ({
	resource: { serviceName: "app" },
	spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));
