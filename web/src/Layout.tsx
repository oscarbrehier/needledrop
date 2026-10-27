import { NavLink, Outlet } from "react-router";

function navClass({ isActive }: { isActive: boolean }): string {
	return isActive
		? "bg-subtle px-3 py-2 rounded-md text-sm font-medium"
		: "px-3 py-2 rounded-md text-sm font-medium text-secondary hover:text-primary transition-colors";
};

export default function Layout() {
	return (

		<div className="min-h-screen flex flex-col bg-surface text-white-900">

			{/* <header className="border-b bg-surface">

				<div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
					<span className="text-lg font-semibold tracking-tight">needledrop</span>
					<nav className="flex gap-6 text-sm font-medium">
						<NavLink to="/" end className={navClass}>
							Library
						</NavLink>
						<NavLink to="/playlist" className={navClass}>
							Playlist
						</NavLink>
					</nav>
				</div>

			</header> */}

			<header className="px-6 h-16 w-full flex items-center justify-between">

				<div>

				</div>

				<div>

					<nav className="flex gap-2">

						<NavLink
							to="/"
							end
							className={navClass}
						>
							Library
						</NavLink>

						<NavLink
							to="/playlist"
							className={navClass}
						>
							Playlist
						</NavLink>

					</nav>

				</div>

			</header>

			<main className="">
				<Outlet />
			</main>

		</div>
	);

};