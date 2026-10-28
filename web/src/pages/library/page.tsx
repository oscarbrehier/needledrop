import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

export type Confidence = "low" | "medium" | "high";

type Tags = {
	languages: string[];
	moods: string[];
	energy: number;
	description: string;
	confidence: Confidence;
};

export type Recording = {
	isrc: string;
	title: string;
	artist: string | null;
	tags: Tags | null;
};

export type TagStatus = "all" | "tagged" | "untagged";

type EnergyRange = { min: number; max: number };

type ChipValue = { value: string; count: number };

type ActiveFilter = { key: string; label: string; remove: () => void };

const PAGE_SIZE = 60;
const MOODS_COLLAPSED = 10;
const ENERGY_LEVELS = [1, 2, 3, 4, 5];
const ENERGY_BAR_HEIGHTS = [4, 6, 8, 10, 12];
const FULL_ENERGY: EnergyRange = { min: 1, max: 5 };
const LANGUAGE_PLACEHOLDERS = new Set(["instrumental", "unknown"]);
const LEADING_ARTICLE = /^(les |la |le |l['’]|the |un |une |ma )/i;

const TAG_STATUSES: { value: TagStatus; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "tagged", label: "Tagged" },
	{ value: "untagged", label: "Untagged" },
];

const CONFIDENCE: Record<Confidence, { dots: number; label: string; className: string }> = {
	high: { dots: 3, label: "High", className: "text-confidence-high" },
	medium: { dots: 2, label: "Medium", className: "text-confidence-medium" },
	low: { dots: 1, label: "Low", className: "text-confidence-low" },
};

function fold(text: string): string {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
};

function initial(title: string): string {
	return title.replace(LEADING_ARTICLE, "").charAt(0).toUpperCase();
};

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
};

function countValues(rows: Recording[], getValues: (row: Recording) => string[]): ChipValue[] {

	const counts = new Map<string, number>();

	for (const row of rows) {

		for (const value of getValues(row)) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		};

	};

	return Array.from(counts, ([value, count]) => ({ value, count }))
		.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

};

function toggle(set: Set<string>, value: string): Set<string> {

	const next = new Set(set);

	if (next.has(value)) next.delete(value);
	else next.add(value);

	return next;

};

function matchesAny(values: string[] | undefined, selected: Set<string>): boolean {
	return selected.size === 0 || (values?.some((value) => selected.has(value)) ?? false);
};

function isFullEnergy(range: EnergyRange): boolean {
	return range.min === FULL_ENERGY.min && range.max === FULL_ENERGY.max;
};

function energyLabel(range: EnergyRange): string {
	return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
};

function pickEnergy(range: EnergyRange, level: number): EnergyRange {

	if (isFullEnergy(range)) return { min: level, max: level };
	if (level < range.min) return { ...range, min: level };
	if (level > range.max) return { ...range, max: level };
	if (range.min === level && range.max === level) return FULL_ENERGY;

	return { min: level, max: level };

};

export default function LibraryPage() {

	const [rows, setRows] = useState<Recording[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState<string>("");
	const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
	const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
	const [energyRange, setEnergyRange] = useState<EnergyRange>(FULL_ENERGY);
	const [limit, setLimit] = useState<number>(PAGE_SIZE);
	const [tagStatus, setTagStatus] = useState<TagStatus>("all");
	const [showAllMoods, setShowAllMoods] = useState<boolean>(false);
	const [openIsrc, setOpenIsrc] = useState<string | null>(null);

	const searchRef = useRef<HTMLInputElement>(null);

	const load = useCallback(() => {
		setError(null);
		setRows(null);
		fetch("/api/tracks")
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<Recording[]>;
			})
			.then(setRows)
			.catch((err) => setError(err instanceof Error ? err.message : String(err)));
	}, []);

	useEffect(load, [load]);

	useEffect(() => {

		function onKeyDown(e: KeyboardEvent) {

			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;

			const target = e.target as HTMLElement | null;

			if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

			e.preventDefault();
			searchRef.current?.focus();

		};

		window.addEventListener("keydown", onKeyDown);

		return () => window.removeEventListener("keydown", onKeyDown);

	}, []);

	const searchIndex = useMemo(() => {

		const index = new Map<string, string>();

		for (const row of rows ?? []) {
			index.set(row.isrc, fold(`${row.title} ${row.artist ?? ""}`));
		};

		return index;

	}, [rows]);

	const moodCounts = useMemo(
		() => countValues(rows ?? [], (row) => row.tags?.moods ?? []),
		[rows],
	);

	const languageCounts = useMemo(
		() =>
			countValues(rows ?? [], (row) => row.tags?.languages ?? []).sort(
				(a, b) =>
					Number(LANGUAGE_PLACEHOLDERS.has(a.value)) -
					Number(LANGUAGE_PLACEHOLDERS.has(b.value)),
			),
		[rows],
	);

	const tagged = useMemo(() => (rows ?? []).filter((row) => row.tags).length, [rows]);

	const deferredQuery = useDeferredValue(query);
	const isStale = query !== deferredQuery;

	const tagFiltersApply = tagStatus !== "untagged";
	const energyActive = !isFullEnergy(energyRange);

	const visible = useMemo(() => {
		if (!rows) return [];

		const q = fold(deferredQuery.trim());

		return rows.filter((row) => {

			const matchesStatus =
				tagStatus === "all" || (tagStatus === "tagged" ? row.tags !== null : row.tags === null);

			const matchesSearch = q === "" || (searchIndex.get(row.isrc) ?? "").includes(q);

			const matchesMoods = !tagFiltersApply || matchesAny(row.tags?.moods, selectedMoods);
			const matchesLanguages =
				!tagFiltersApply || matchesAny(row.tags?.languages, selectedLanguages);

			const matchesEnergy =
				!tagFiltersApply ||
				!energyActive ||
				(row.tags !== null &&
					row.tags.energy >= energyRange.min &&
					row.tags.energy <= energyRange.max);

			return matchesStatus && matchesSearch && matchesMoods && matchesLanguages && matchesEnergy;

		});

	}, [rows, searchIndex, deferredQuery, tagStatus, tagFiltersApply, selectedMoods, selectedLanguages, energyRange, energyActive]);

	function filterChange<T>(set: (value: T) => void) {

		return (value: T) => {
			set(value);
			setLimit(PAGE_SIZE);
		};

	};

	const changeQuery = filterChange(setQuery);
	const changeTagStatus = filterChange(setTagStatus);
	const changeEnergy = filterChange(setEnergyRange);
	const changeMoods = filterChange(setSelectedMoods);
	const changeLanguages = filterChange(setSelectedLanguages);

	function clearAll() {
		setQuery("");
		setTagStatus("all");
		setEnergyRange(FULL_ENERGY);
		setSelectedMoods(new Set());
		setSelectedLanguages(new Set());
		setLimit(PAGE_SIZE);
	};

	if (error) {

		return (

			<div
				role="alert"
				className="flex min-h-90 flex-col items-center justify-center gap-3 rounded-lg p-8 text-center"
			>

				<span
					aria-hidden="true"
					className="grid size-9 place-items-center rounded-full border border-danger/45 text-danger"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
						<path d="M12 7v6M12 16.5h.01" />
					</svg>
				</span>

				<h2 className="font-display text-title-3">Can’t reach your library</h2>

				<p className="max-w-75 text-body text-secondary">
					The needledrop server didn’t answer. Make sure it’s running, then try again.
				</p>

				<span className="font-mono text-caption font-normal text-muted">GET /api/tracks · {error}</span>

				<button
					type="button"
					onClick={load}
					className="mt-1.5 h-9 rounded-md bg-inverse px-3.5 text-body font-semibold text-on-inverse transition-colors hover:bg-inverse-hover"
				>
					Try again
				</button>

			</div>

		);

	};

	if (!rows) {

		return (

			<div aria-busy="true" className="w-full h-auto flex justify-center py-10">

				<div className="w-full max-w-6xl flex flex-col gap-7">

					<h1 className="font-display text-title-1">Library</h1>

					<span className="h-12 animate-skeleton rounded-xl bg-surface-overlay" />

					<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(380px,100%),1fr))] gap-2.5">
						{[60, 46, 54, 38, 50, 42].map((width, i) => (
							<li key={i} className="flex gap-3.5 rounded-lg border border-subtle p-3.5">
								<span className="size-13 flex-none animate-skeleton rounded-[8px] bg-surface-overlay" />
								<span className="flex flex-1 flex-col gap-2 pt-1">
									<span className="h-3 animate-skeleton rounded bg-surface-overlay" style={{ width: `${width}%` }} />
									<span className="h-2.5 w-[30%] animate-skeleton rounded bg-surface-overlay" />
									<span className="h-2.5 w-[80%] animate-skeleton rounded bg-surface-overlay" />
								</span>
							</li>
						))}
					</ul>

					<span role="status" className="sr-only">Loading recordings</span>

				</div>

			</div>

		);

	};

	const shown = visible.slice(0, limit);
	const remaining = visible.length - shown.length;
	const openRecording = openIsrc ? rows.find((row) => row.isrc === openIsrc) ?? null : null;

	const visibleMoods = showAllMoods
		? moodCounts
		: moodCounts.filter((mood, i) => i < MOODS_COLLAPSED || selectedMoods.has(mood.value));

	const trimmedQuery = query.trim();

	const anyFilter =
		trimmedQuery !== "" ||
		tagStatus !== "all" ||
		energyActive ||
		selectedMoods.size > 0 ||
		selectedLanguages.size > 0;

	const activeFilters: ActiveFilter[] = [];

	if (trimmedQuery) {
		activeFilters.push({ key: "q", label: `“${trimmedQuery}”`, remove: () => changeQuery("") });
	};

	if (tagStatus !== "all") {

		activeFilters.push({
			key: "status",
			label: tagStatus === "tagged" ? "Tagged only" : "Untagged only",
			remove: () => changeTagStatus("all"),
		});

	};

	if (tagFiltersApply) {

		if (energyActive) {

			activeFilters.push({
				key: "energy",
				label: `Energy ${energyLabel(energyRange)}`,
				remove: () => changeEnergy(FULL_ENERGY),
			});

		};

		for (const mood of selectedMoods) {

			activeFilters.push({
				key: `mood:${mood}`,
				label: mood,
				remove: () => changeMoods(toggle(selectedMoods, mood)),
			});

		};

		for (const language of selectedLanguages) {

			activeFilters.push({
				key: `lang:${language}`,
				label: capitalize(language),
				remove: () => changeLanguages(toggle(selectedLanguages, language)),
			});

		};

	};

	return (

		<div className="w-full h-auto flex justify-center py-10">

			<div className="w-full max-w-6xl flex flex-col gap-7">

				<div className="flex flex-col gap-4.5">

					<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
						<h1 className="font-display text-title-1">Library</h1>
						<span className="text-small tabular-nums text-muted">
							{rows.length.toLocaleString()} recordings · {tagged.toLocaleString()} tagged
						</span>
					</div>

					<div className="flex h-12 items-center gap-2.5 rounded-xl border border-subtle bg-surface-raised pl-4 pr-3 transition-colors duration-150 focus-within:border-emphasis">

						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="flex-none text-muted" aria-hidden="true">
							<circle cx="11" cy="11" r="7" />
							<path d="M20 20l-3.5-3.5" />
						</svg>

						<label htmlFor="library-search" className="sr-only">Search by title or artist</label>

						<input
							ref={searchRef}
							id="library-search"
							type="search"
							placeholder="Search by title or artist"
							value={query}
							onChange={(e) => changeQuery(e.target.value)}
							className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-primary outline-none focus-visible:outline-none"
						/>

						<kbd className="rounded-sm border border-subtle px-1.75 py-0.5 font-mono text-[11px] text-muted">/</kbd>

					</div>

				</div>

				<div className="flex flex-wrap items-start gap-10">

					<aside aria-label="Filters" className="flex max-w-70 flex-[1_1_240px] flex-col">

						<div className="flex h-8 items-center justify-between pb-3">

							<span className="font-display text-card-title">Filters</span>

							{anyFilter && (
								<button
									type="button"
									onClick={clearAll}
									className="h-7 rounded-[8px] px-2 text-small font-medium text-secondary transition-colors hover:bg-surface-overlay hover:text-primary"
								>
									Clear all
								</button>
							)}

						</div>

						<div className="border-t border-subtle py-4">

							<div role="radiogroup" aria-label="Tag status" className="grid grid-cols-3 gap-0.5 rounded-md border border-subtle p-0.5">

								{TAG_STATUSES.map(({ value, label }) => {
									const active = tagStatus === value;
									return (
										<button
											key={value}
											type="button"
											role="radio"
											aria-checked={active}
											onClick={() => changeTagStatus(value)}
											className={`h-7 rounded-[8px] text-small transition-colors ${active
												? "bg-surface-strong font-semibold text-primary"
												: "font-medium text-secondary hover:text-primary"
												}`}
										>
											{label}
										</button>
									);
								})}

							</div>

							{!tagFiltersApply && (
								<p className="mt-3 text-caption font-normal text-muted">
									Energy, mood and language filters don’t apply to untagged recordings.
								</p>
							)}

						</div>

						<div inert={!tagFiltersApply} className={tagFiltersApply ? "" : "opacity-50"}>

							<fieldset className="m-0 flex flex-col gap-2.5 border-0 border-t border-subtle px-0 py-4">

								<legend className="float-left mb-2.5 flex w-full justify-between p-0 text-small font-semibold">
									<span>Energy</span>
									<span className="font-normal tabular-nums text-secondary">
										{energyActive ? energyLabel(energyRange) : "Any"}
									</span>
								</legend>

								<div className="grid grid-cols-5 overflow-hidden rounded-md border border-subtle">
									{ENERGY_LEVELS.map((level, i) => {
										const on = energyActive && level >= energyRange.min && level <= energyRange.max;
										return (
											<button
												key={level}
												type="button"
												aria-pressed={on}
												aria-label={`Energy ${level}`}
												onClick={() => changeEnergy(pickEnergy(energyRange, level))}
												className={`h-8 text-small tabular-nums transition-colors ${i > 0 ? "border-l border-subtle" : ""} ${on
													? "bg-surface-strong font-semibold text-primary"
													: `hover:bg-surface-overlay ${energyActive ? "text-muted" : "text-primary"}`
													}`}
											>
												{level}
											</button>
										);
									})}
								</div>

							</fieldset>

							<fieldset className="m-0 flex flex-col gap-2.5 border-0 border-t border-subtle px-0 py-4">

								<legend className="float-left mb-2.5 w-full p-0 text-small font-semibold">
									Moods <span className="font-normal text-muted">· match any</span>
								</legend>

								<div className="flex flex-wrap gap-1.5">
									{visibleMoods.map(({ value, count }) => (
										<FilterChip
											key={value}
											label={value}
											count={count}
											selected={selectedMoods.has(value)}
											onToggle={() => changeMoods(toggle(selectedMoods, value))}
										/>
									))}
								</div>

								{moodCounts.length > MOODS_COLLAPSED && (
									<button
										type="button"
										aria-expanded={showAllMoods}
										onClick={() => setShowAllMoods((prev) => !prev)}
										className="flex h-7 items-center gap-1 self-start text-small font-medium text-secondary transition-colors hover:text-primary"
									>
										{showAllMoods ? "Fewer moods" : `All ${moodCounts.length} moods`}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={showAllMoods ? "rotate-180" : ""} aria-hidden="true">
											<path d="M6 9l6 6 6-6" />
										</svg>
									</button>
								)}

							</fieldset>

							<fieldset className="m-0 flex flex-col gap-2.5 border-0 border-t border-subtle px-0 py-4">

								<legend className="float-left mb-2.5 w-full p-0 text-small font-semibold">
									Languages <span className="font-normal text-muted">· match any</span>
								</legend>

								<div className="flex flex-wrap gap-1.5">
									{languageCounts.map(({ value, count }) => (
										<FilterChip
											key={value}
											label={capitalize(value)}
											count={count}
											selected={selectedLanguages.has(value)}
											onToggle={() => changeLanguages(toggle(selectedLanguages, value))}
										/>
									))}
								</div>

							</fieldset>

						</div>

					</aside>

					<section aria-label="Recordings" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">

						<div className="flex min-h-8 flex-wrap items-center gap-1.5">

							<span aria-live="polite" className="mr-2 text-body font-semibold tabular-nums">
								{anyFilter
									? `${visible.length.toLocaleString()} of ${rows.length.toLocaleString()} recordings`
									: `${rows.length.toLocaleString()} recordings`}
							</span>

							{activeFilters.map((filter) => (
								<span
									key={filter.key}
									className="inline-flex h-[26px] items-center gap-0.5 rounded-[8px] bg-surface-overlay pl-[9px] pr-0.5 text-small"
								>
									{filter.label}
									<button
										type="button"
										aria-label={`Remove ${filter.label}`}
										onClick={filter.remove}
										className="grid size-[22px] place-items-center rounded-sm text-muted transition-colors hover:bg-surface-strong hover:text-primary"
									>
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
											<path d="M6 6l12 12M18 6L6 18" />
										</svg>
									</button>
								</span>
							))}

						</div>

						{visible.length === 0 ? (

							<div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-strong p-8 text-center">

								<h2 className="font-display text-title-3">No recordings match</h2>

								<p className="max-w-[280px] text-body text-secondary">
									Try removing a filter or searching for something else.
								</p>

								<button
									type="button"
									onClick={clearAll}
									className="mt-1.5 h-9 rounded-md border border-strong px-3.5 text-body font-semibold transition-colors hover:bg-surface-overlay"
								>
									Clear filters
								</button>

							</div>

						) : (

							<div className={`transition-opacity ${isStale ? "opacity-60" : ""}`}>

								<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(380px,100%),1fr))] gap-2.5">
									{shown.map((row) => (
										<li key={row.isrc} className="flex">
											<RecordingCard recording={row} onOpen={() => setOpenIsrc(row.isrc)} />
										</li>
									))}
								</ul>

								{remaining > 0 && (
									<div className="flex flex-col items-center gap-2 pt-8">
										<button
											type="button"
											onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
											className="h-10 rounded-md border border-strong px-4 text-body font-semibold transition-colors hover:bg-surface-overlay"
										>
											Show {Math.min(PAGE_SIZE, remaining)} more
										</button>
										<span className="text-caption font-normal tabular-nums text-muted">
											Showing {shown.length.toLocaleString()} of {visible.length.toLocaleString()}
										</span>
									</div>
								)}

							</div>

						)}

					</section>

				</div>

				{openRecording?.tags && (
					<DetailsPanel recording={openRecording} tags={openRecording.tags} onClose={() => setOpenIsrc(null)} />
				)}

			</div>
		</div>

	);

};

function FilterChip({ label, count, selected, onToggle }: {
	label: string;
	count: number;
	selected: boolean;
	onToggle: () => void;
}) {

	return (

		<button
			type="button"
			aria-pressed={selected}
			onClick={onToggle}
			className={`flex h-7 items-center gap-[5px] rounded-full border px-2.5 text-small transition-colors duration-150 ${selected
				? "border-inverse bg-inverse font-semibold text-on-inverse"
				: "border-subtle font-medium text-primary hover:border-strong"
				}`}
		>
			{label}
			<span className={`text-[11px] tabular-nums ${selected ? "text-on-inverse/60" : "text-muted"}`}>
				{count.toLocaleString()}
			</span>
		</button>

	);

};

function EnergyMeter({ energy }: { energy: number }) {

	return (

		<span aria-hidden="true" className="flex h-3 items-end gap-0.5">
			{ENERGY_BAR_HEIGHTS.map((height, i) => (
				<span
					key={height}
					className={`block w-[3px] rounded-[1px] ${i < energy ? "bg-primary" : "bg-surface-strong"}`}
					style={{ height }}
				/>
			))}
		</span>

	);

};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {

	const { dots, label, className } = CONFIDENCE[confidence];

	return (

		<span className={`inline-flex flex-none items-center gap-[5px] text-caption ${className}`}>

			<span aria-hidden="true" className="flex gap-0.5">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className={`size-[5px] rounded-full ${i < dots ? "bg-current" : "border border-muted"}`}
					/>
				))}
			</span>

			{label}

			<span className="sr-only"> confidence</span>

		</span>

	);

};

function Tag({ children }: { children: string }) {

	return (

		<span className="inline-flex h-[22px] items-center rounded-sm bg-surface-overlay px-2 text-caption text-secondary">
			{children}
		</span>

	);

};

function RecordingCard({ recording, onOpen }: { recording: Recording; onOpen: () => void }) {

	const { title, artist, tags } = recording;
	const artistName = artist ?? "Unknown artist";

	const tile = (
		<span
			aria-hidden="true"
			className={`grid size-13 flex-none place-items-center rounded-[8px] font-display text-[20px] font-semibold text-muted ${tags ? "bg-surface-overlay" : "border border-dashed border-strong"
				}`}
		>
			{initial(title)}
		</span>
	);

	if (!tags) {

		return (

			<div className="flex flex-1 items-start gap-3.5 rounded-lg border border-subtle p-3.5">

				{tile}

				<span className="flex min-w-0 flex-1 flex-col gap-2">
					<span className="flex min-w-0 flex-col gap-px">
						<span className="text-card-title text-secondary">{title}</span>
						<span className="text-small text-secondary">{artistName}</span>
					</span>
					<span className="text-small text-muted">Not tagged yet.</span>
				</span>

			</div>

		);

	};

	return (

		<button
			type="button"
			onClick={onOpen}
			aria-label={`${title} by ${artistName}, show details`}
			className="flex flex-1 items-start gap-3.5 rounded-lg border border-subtle p-3.5 text-left transition-colors duration-150 hover:border-strong hover:bg-surface-raised"
		>

			{tile}

			<span className="flex min-w-0 flex-1 flex-col gap-2">

				<span className="flex min-w-0 flex-col gap-px">
					<span className="flex items-baseline justify-between gap-2.5">
						<span className="font-display text-card-title">{title}</span>
						<ConfidenceBadge confidence={tags.confidence} />
					</span>
					<span className="text-small text-secondary">{artistName}</span>
				</span>

				{tags.description && <span className="text-small text-secondary">{tags.description}</span>}

				<span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">

					{tags.moods.length > 0 && (
						<span className="flex flex-wrap gap-1">
							{tags.moods.map((mood) => <Tag key={mood}>{mood}</Tag>)}
						</span>
					)}

					<span role="img" aria-label={`Energy ${tags.energy} of 5`} className="flex items-end gap-[5px]">
						<EnergyMeter energy={tags.energy} />
						<span aria-hidden="true" className="text-caption leading-none tabular-nums text-secondary">{tags.energy}</span>
					</span>

					{tags.languages.length > 0 && (
						<span className="text-caption font-normal text-muted">
							{tags.languages.map(capitalize).join(", ")}
						</span>
					)}

				</span>

			</span>

		</button>

	);

};

function DetailsPanel({ recording, tags, onClose }: { recording: Recording; tags: Tags; onClose: () => void }) {

	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {

		const returnTo = document.activeElement as HTMLElement | null;

		closeRef.current?.focus();

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		};

		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			returnTo?.focus();
		};

	}, [onClose]);

	const rowLabel = "border-b border-subtle py-2.5 text-small text-muted";
	const rowValue = "m-0 border-b border-subtle py-2.5 text-small";

	return (

		<>

			<div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-10 animate-fade-in bg-scrim" />

			<aside
				role="dialog"
				aria-modal="true"
				aria-labelledby="recording-details-title"
				className="fixed inset-y-0 right-0 z-11 flex w-[min(440px,100%)] animate-slide-in flex-col gap-[22px] overflow-y-auto border-l border-strong bg-surface-raised p-6"
			>

				<div className="flex items-start justify-between gap-4">

					<span aria-hidden="true" className="grid size-22 place-items-center rounded-md bg-surface-overlay font-display text-[36px] font-semibold text-muted">
						{initial(recording.title)}
					</span>

					<button
						ref={closeRef}
						type="button"
						aria-label="Close details"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-[8px] text-secondary transition-colors hover:bg-surface-overlay hover:text-primary"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>

				</div>

				<div className="flex flex-col gap-1">
					<h2 id="recording-details-title" className="font-display text-[24px] leading-[1.15] font-bold tracking-[-0.02em]">
						{recording.title}
					</h2>
					<span className="text-body text-secondary">{recording.artist ?? "Unknown artist"}</span>
					<span className="font-mono text-caption font-normal text-muted">{recording.isrc}</span>
				</div>

				{tags.description && <p className="text-body leading-[1.55] text-secondary">{tags.description}</p>}

				<dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] items-center border-t border-subtle">

					<dt className={rowLabel}>Moods</dt>
					<dd className={`${rowValue} flex flex-wrap gap-1`}>
						{tags.moods.length > 0 ? tags.moods.map((mood) => <Tag key={mood}>{mood}</Tag>) : "—"}
					</dd>

					<dt className={rowLabel}>Energy</dt>
					<dd className={`${rowValue} flex items-end gap-1.5`}>
						<EnergyMeter energy={tags.energy} />
						<span className="leading-none tabular-nums">{tags.energy} of 5</span>
					</dd>

					<dt className={rowLabel}>Language</dt>
					<dd className={rowValue}>{tags.languages.map(capitalize).join(", ") || "—"}</dd>

					<dt className={rowLabel}>Confidence</dt>
					<dd className={rowValue}>
						<ConfidenceBadge confidence={tags.confidence} />
					</dd>

				</dl>

			</aside>

		</>

	);

};