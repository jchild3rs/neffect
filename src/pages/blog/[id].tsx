import "./[id].css";
import Counter from "../../components/counter.tsx";
import { useNavigation } from "../../lib/router/use-navigation.ts";
import type { PageData } from "./[id].data.ts";

export default function Page({
	data,
	params,
	query,
}: {
	query: Record<string, string | string[] | undefined>;
	params: { id: string };
	data: PageData;
}) {
	const { navigate } = useNavigation();

	return (
		<div className="root">
			<h1>Blog Post ID: {params.id}</h1>
			query params: {JSON.stringify(query)}
			<div>path params: {JSON.stringify(params)}</div>
			<pre>{JSON.stringify(data)}</pre>
			<button
				type="button"
				onClick={() => navigate(`/blog/432423?asdfasdf=${Math.random()}`)}
			>
				Test programatic navigation
			</button>
			<Counter initialCount={10} />
		</div>
	);
}
