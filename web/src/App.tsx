import { Route, Routes } from "react-router";
import Layout from "./Layout";
import LibraryPage from "./pages/library/page";
import PlaylistPage from "./pages/playlist/page";
import NotFoundPage from "./pages/not-found/page";

export default function App() {

	return (

		<Routes>
			<Route element={<Layout />}>
				<Route index element={<LibraryPage />} />
				<Route path="playlist" element={<PlaylistPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Route>
		</Routes>

	);

}; 