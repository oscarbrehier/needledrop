import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Layout from "../../Layout";
import { ChipGroup, type ChipValue } from "../../components/ChipGroup";
import { RecordingRow } from "../../components/RecordingRow";

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

const PAGE_SIZE = 200;
const ENERGY_LEVELS = [1, 2, 3, 4, 5];
const FULL_ENERGY: EnergyRange = { min: 1, max: 5 };
const LANGUAGE_PLACEHOLDERS = new Set(["instrumental", "unknown"]);

const TAG_STATUSES: { value: TagStatus; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "tagged", label: "Tagged" },
	{ value: "untagged", label: "Untagged" },
];

function fold(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

export default function LibraryPage() {

	const [rows, setRows] = useState<Recording[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState<string>("");
	const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
	const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
	const [energyRange, setEnergyRange] = useState<EnergyRange>(FULL_ENERGY);
	const [limit, setLimit] = useState<number>(PAGE_SIZE);
	const [tagStatus, setTagStatus] = useState<TagStatus>("all");

	useEffect(() => {
		fetch("/api/tracks")
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json() as Promise<Recording[]>;
			})
			.then(setRows)
			.catch((err) => setError(String(err)));
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

	const visible = useMemo(() => {
		if (!rows) return [];

		const q = fold(deferredQuery.trim());
		const energyActive = !isFullEnergy(energyRange);

		return rows.filter((row) => {

			const matchesStatus =
				tagStatus === "all" || (tagStatus === "tagged" ? row.tags !== null : row.tags === null);

			const matchesSearch = q === "" || (searchIndex.get(row.isrc) ?? "").includes(q);

			const matchesMoods = !tagFiltersApply || matchesAny(row.tags?.moods, selectedMoods);
			const matchesLanguages =
				!tagFiltersApply || matchesAny(row.tags?.languages, selectedLanguages);

			const matchesEnergy =
				!energyActive ||
				(row.tags !== null &&
					row.tags.energy >= energyRange.min &&
					row.tags.energy <= energyRange.max);

			return matchesStatus && matchesSearch && matchesMoods && matchesLanguages && matchesEnergy;

		});

	}, [rows, searchIndex, deferredQuery, tagStatus, tagFiltersApply, selectedMoods, selectedLanguages, energyRange]);

	if (error) {

		return (

				<p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					Could not load tracks: {error}
				</p>
	
		);

	};

	if (!rows) {

		return (

				<p className="text-sm text-stone-500">Loading…</p>

		);

	};

	const shown = visible.slice(0, limit);
	const remaining = visible.length - shown.length;

	function setEnergyMin(min: number) {
		setEnergyRange((prev) => ({ min, max: Math.max(prev.max, min) }));
	};

	function setEnergyMax(max: number) {
		setEnergyRange((prev) => ({ min: Math.min(prev.min, max), max }));
	};

	return (

		<div>

			<div className="mb-6 flex items-baseline justify-between">
				<h1 className="text-2xl font-semibold">Library</h1>
				<p className="text-sm text-stone-500">
					{visible.length.toLocaleString()} of {rows.length.toLocaleString()} recordings ·{" "}
					{tagged.toLocaleString()} tagged in library
				</p>
			</div>

			<div className="mb-6 flex flex-wrap items-center gap-3">

				<input
					type="search"
					placeholder="Search title or artist"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
				/>

				<div
					role="group"
					aria-label="Tag status"
					className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm"
				>

					{TAG_STATUSES.map(({ value, label }) => {
						const active = tagStatus === value;
						return (
							<button
								key={value}
								type="button"
								aria-pressed={active}
								onClick={() => setTagStatus(value)}
								className={`rounded px-3 py-1 ${active ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
									}`}
							>
								{label}
							</button>
						);
					})}

				</div>

			</div>

			{!tagFiltersApply && (
				<p className="mb-2 text-xs text-stone-500">
					Mood, language and energy filters don't apply to untagged recordings.
				</p>
			)}

			<div inert={!tagFiltersApply} className={tagFiltersApply ? "" : "opacity-50"}>

				<ChipGroup
					label="Moods"
					hint="match any"
					values={moodCounts}
					selected={selectedMoods}
					onToggle={(mood) => setSelectedMoods((prev) => toggle(prev, mood))}
					onClear={() => setSelectedMoods(new Set())}
				/>

				<ChipGroup
					label="Languages"
					hint="match any"
					values={languageCounts}
					selected={selectedLanguages}
					onToggle={(language) => setSelectedLanguages((prev) => toggle(prev, language))}
					onClear={() => setSelectedLanguages(new Set())}
				/>

				<div className="mb-6 flex items-center gap-3 text-sm text-stone-700">
					<span className="text-xs font-medium uppercase tracking-wide text-stone-500">
						Energy
					</span>

					<label className="flex items-center gap-1">
						from
						<select
							value={energyRange.min}
							onChange={(e) => setEnergyMin(Number(e.target.value))}
							className="rounded-md border border-stone-300 bg-white px-2 py-1"
						>
							{ENERGY_LEVELS.map((level) => (
								<option key={level} value={level}>
									{level}
								</option>
							))}
						</select>
					</label>

					<label className="flex items-center gap-1">
						to
						<select
							value={energyRange.max}
							onChange={(e) => setEnergyMax(Number(e.target.value))}
							className="rounded-md border border-stone-300 bg-white px-2 py-1"
						>
							{ENERGY_LEVELS.map((level) => (
								<option key={level} value={level}>
									{level}
								</option>
							))}
						</select>
					</label>

					{!isFullEnergy(energyRange) && (
						<button
							type="button"
							onClick={() => setEnergyRange(FULL_ENERGY)}
							className="text-xs text-stone-500 underline hover:text-stone-800"
						>
							Reset
						</button>
					)}
				</div>

			</div>

			{visible.length === 0 ? (
				<p className="text-sm text-stone-500">No recordings match.</p>
			) : (
				<div className={isStale ? "opacity-60 transition-opacity" : "transition-opacity"}>
					<div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
						<table className="w-full text-left text-sm">
							<thead className="bg-stone-100 text-xs uppercase tracking-wide text-stone-500">
								<tr>
									<th className="px-4 py-3 font-medium">Title</th>
									<th className="px-4 py-3 font-medium">Artist</th>
									<th className="px-4 py-3 font-medium">Moods</th>
									<th className="px-4 py-3 font-medium">Energy</th>
									<th className="px-4 py-3 font-medium">Confidence</th>
									<th className="px-4 py-3 font-medium">Languages</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-stone-100">
								{shown.map((row) => (
									<RecordingRow key={row.isrc} recording={row} />
								))}
							</tbody>
						</table>
					</div>

					{remaining > 0 && (
						<div className="mt-4 flex items-center justify-between text-sm text-stone-500">
							<span>
								Showing {shown.length.toLocaleString()} of {visible.length.toLocaleString()}
							</span>
							<button
								type="button"
								onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
								className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:bg-stone-50"
							>
								Show {Math.min(PAGE_SIZE, remaining)} more
							</button>
						</div>
					)}
				</div>
			)}

		</div>

	);

};

function Muted() {
	return <span className="text-stone-400">—</span>;
}