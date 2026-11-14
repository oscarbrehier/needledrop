import { Minus, Plus, X } from "lucide-react";
import { useState } from "react";
import { MAX_TRACKS, MIN_TRACKS } from "./page";
import { capitalize, removeFilter } from "./filters";
import type { ParsedPrompt } from "./types";

const ENERGY_LEVELS = [1, 2, 3, 4, 5];
const CHIP = "inline-flex h-[26px] items-center gap-1 rounded-sm bg-surface-overlay text-small tabular-nums text-secondary";
const ICON_BUTTON = "grid size-[22px] place-items-center rounded-[5px] text-muted transition-colors duration-150 enabled:hover:bg-surface-strong enabled:hover:text-primary disabled:opacity-30";

function without<T>(values: T[] | undefined, value: T): T[] | undefined {
	const next = (values ?? []).filter((v) => v !== value);
	return next.length > 0 ? next : undefined;
};

type FilterChipsProps = {
	filters: ParsedPrompt;
	energyRelaxed: boolean;
	onChange: (next: ParsedPrompt) => void;
};

export function FilterChips({ filters, energyRelaxed, onChange }: FilterChipsProps) {

	const hasEnergy = filters.energyMin !== undefined || filters.energyMax !== undefined;

	return (

		<div role="group" aria-label="Understood as" className="flex animate-fade-up flex-wrap items-center gap-1">

			<SemanticChip value={filters.semantic} onCommit={(semantic) => onChange({ ...filters, semantic })} />

			{filters.languages?.map((language) => (
				<RemovableChip
					key={`language-${language}`}
					label={capitalize(language)}
					removeLabel={`Remove language ${language}`}
					onRemove={() => onChange({ ...filters, languages: without(filters.languages, language) })}
				/>
			))}

			{hasEnergy && (
				<EnergyChip
					min={filters.energyMin ?? 1}
					max={filters.energyMax ?? 5}
					relaxed={energyRelaxed}
					onChange={(min, max) => onChange({
						...filters,
						energyMin: min === 1 ? undefined : min,
						energyMax: max === 5 ? undefined : max,
					})}
					onRemove={() => onChange(removeFilter(filters, "energy"))}
				/>
			)}

			{filters.moods?.map((mood) => (
				<RemovableChip
					key={`mood-${mood}`}
					label={mood}
					removeLabel={`Remove mood ${mood}`}
					onRemove={() => onChange({ ...filters, moods: without(filters.moods, mood) })}
				/>
			))}

			<span className={`${CHIP} px-0.5`}>
				<button
					type="button"
					aria-label="Fewer tracks"
					disabled={filters.size <= MIN_TRACKS}
					onClick={() => onChange({ ...filters, size: filters.size - 1 })}
					className={ICON_BUTTON}
				>
					<Minus size={11} strokeWidth={2.2} aria-hidden="true" />
				</button>
				<span className="px-0.5">{filters.size} tracks</span>
				<button
					type="button"
					aria-label="More tracks"
					disabled={filters.size >= MAX_TRACKS}
					onClick={() => onChange({ ...filters, size: filters.size + 1 })}
					className={ICON_BUTTON}
				>
					<Plus size={11} strokeWidth={2.2} aria-hidden="true" />
				</button>
			</span>

		</div>

	);

};

function RemovableChip({ label, removeLabel, onRemove }: { label: string; removeLabel: string; onRemove: () => void }) {

	return (

		<span className={`${CHIP} pr-0.5 pl-[9px]`}>
			{label}
			<button type="button" aria-label={removeLabel} onClick={onRemove} className={ICON_BUTTON}>
				<X size={11} strokeWidth={2.2} aria-hidden="true" />
			</button>
		</span>

	);

};

function SemanticChip({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {

	const [draft, setDraft] = useState<string | null>(null);

	function commit() {
		const next = draft?.trim() ?? "";
		setDraft(null);
		if (next !== "" && next !== value) onCommit(next);
	};

	if (draft !== null) {

		return (

			<input
				autoFocus
				aria-label="Search phrase"
				value={draft}
				size={Math.max(12, draft.length + 1)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") setDraft(null);
				}}
				className={`${CHIP} border border-emphasis px-[8px] text-primary outline-none`}
			/>

		);

	};

	return (

		<button
			type="button"
			title="Edit the search phrase"
			onClick={() => setDraft(value)}
			className={`${CHIP} px-[9px] transition-colors duration-150 hover:bg-surface-strong hover:text-primary`}
		>
			“{value}”
		</button>

	);

};

type EnergyChipProps = {
	min: number;
	max: number;
	relaxed: boolean;
	onChange: (min: number, max: number) => void;
	onRemove: () => void;
};

function EnergyChip({ min, max, relaxed, onChange, onRemove }: EnergyChipProps) {

	const select = "cursor-pointer appearance-none rounded-[4px] bg-transparent px-0.5 text-primary outline-none hover:bg-surface-strong focus-visible:bg-surface-strong";

	return (

		<span
			className={`${CHIP} pr-0.5 pl-[9px]`}
			title={relaxed ? "Too few tracks matched this range, so it was ignored" : undefined}
		>

			<span className={relaxed ? "line-through" : undefined}>energy</span>

			<select
				aria-label="Lowest energy"
				value={min}
				onChange={(e) => {
					const next = Number(e.target.value);
					onChange(next, Math.max(next, max));
				}}
				className={select}
			>
				{ENERGY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
			</select>

			–

			<select
				aria-label="Highest energy"
				value={max}
				onChange={(e) => {
					const next = Number(e.target.value);
					onChange(Math.min(min, next), next);
				}}
				className={select}
			>
				{ENERGY_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
			</select>

			{relaxed && <span className="text-caption font-normal text-muted">ignored</span>}

			<button type="button" aria-label="Remove energy range" onClick={onRemove} className={ICON_BUTTON}>
				<X size={11} strokeWidth={2.2} aria-hidden="true" />
			</button>

		</span>

	);

};
