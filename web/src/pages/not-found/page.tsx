import { Link } from "react-router";

export default function NotFoundPage() {
	return (
		<>
			<title>Not found · needledrop</title>
			<h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
			<p className="text-sm text-stone-600">
				Nothing lives at this address.{" "}
				<Link to="/" className="underline hover:text-stone-900">
					Back to the library
				</Link>
			</p>
		</>
	);
};