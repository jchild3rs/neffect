import type { PropsWithChildren } from "react";
import { Link } from "../lib/router/link.tsx";

export default function App(props: PropsWithChildren) {
	return (
		<>
			<pre>{`<Link />`} usage:</pre>
			<Link href="/">Home</Link>
			<Link href="/blog">All posts</Link>
			<Link href="/blog/123">Post By Id</Link>
			<Link href="/blog/12345?weeee=true">Post With Query</Link>

			{props.children}
		</>
	);
}
