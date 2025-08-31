import type { PageData } from "./blog.data.ts";

export default function Page(props: { data: PageData }) {
	return <div>{JSON.stringify(props.data.posts)}</div>;
}
