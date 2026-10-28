import { NavLink, Outlet } from "react-router";

function navClass({ isActive }: { isActive: boolean }): string {
	return isActive
		? "bg-subtle px-3 py-2 rounded-md text-sm font-medium"
		: "px-3 py-2 rounded-md text-sm font-medium text-secondary hover:text-primary transition-colors";
};

export default function Layout() {
	return (

		<div className="min-h-screen flex flex-col bg-surface text-white-900">

			<header className="px-6 h-16 w-full flex items-center justify-between">

				<div>

				</div>

				<div>

					<nav className="flex gap-2">

						<NavLink
							to="/playlist"
							className={navClass}
						>
							Playlist
						</NavLink>

						<NavLink
							to="/"
							end
							className={navClass}
						>
							Library
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