import "./index.css";
import LogoSrc from "../assets/preact-logo.svg";
import Counter from "../components/counter.tsx";
import { Link } from "../lib/router/link.tsx";
import type { PageData } from "./index.data.ts";

export default function Page(_props: { data: PageData }) {
	// console.log(props.data);
	return (
		<div>
			<img src={LogoSrc} alt="Preact Logo" />

			<Counter initialCount={0} />

			<h1>Welcome to the Preact App</h1>
			<p>This is a simple Preact app.</p>

			<div className="home-links">
				<Link href="/">Home</Link>
				<Link href="/blog/123">Post</Link>
				<Link href="/blog/123?weeee=true">Post</Link>
			</div>
		</div>
	);
}
