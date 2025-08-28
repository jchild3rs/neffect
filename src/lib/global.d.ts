declare module "*.css" {
	const content: string;
	export default content;
}

declare module "*.svg" {
	const content: string;
	export default content;
}

declare module "*.json" {
	const content: Record<string, unknown>;
	export default content;
}

interface Window {
	__loadCache: Record<string, string>;
	__hasProvidedApp: boolean;
}
