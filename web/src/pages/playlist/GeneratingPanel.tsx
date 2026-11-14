import { ChevronDown, ChevronUp, TriangleAlert, X } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { FilterChips } from "./FilterChips";
import { describeFilter, removeFilter } from "./filters";
import type { CallState } from "./page";
import { SaveDialog } from "./SaveDialog";
import type { FunnelStats, ParsedPrompt, ParseRequest, TrackResult } from "./types";

type GeneratingPanelProps = {
	request: ParseRequest;
	parse: CallState;
	filters: ParsedPrompt | null;
	preview: CallState;
	funnel: FunnelStats | null;
	elapsedMs: number | null;
	tracks: TrackResult[];
	edited: boolean;
	onCancel: () => void;
	onNewPrompt: () => void;
	onRetryParse: () => void;
	onFiltersChange: (next: ParsedPrompt) => void;
	onRetryPreview: () => void;
	onRegenerate: () => void;
	onRemoveTrack: (index: number) => void;
	onMoveTrack: (from: number, to: number) => void;
};

const MAX_SKELETON_ROWS = 8;
const ENERGY_BAR_HEIGHTS = [4, 6, 8, 10, 12];
const SKELETON_CHIP_WIDTHS = ["w-[58px]", "w-[84px]", "w-[44px]", "w-[150px]", "w-[70px]"];
const SKELETON_TITLE_WIDTHS = ["w-[46%]", "w-[38%]", "w-[52%]", "w-[34%]", "w-[44%]", "w-[40%]", "w-[48%]", "w-[36%]"];
const SKELETON_ARTIST_WIDTHS = ["w-[24%]", "w-[28%]", "w-[20%]", "w-[22%]", "w-[26%]", "w-[18%]", "w-[24%]", "w-[22%]"];
const ROW_GRID = "grid grid-cols-[24px_minmax(0,1fr)_48px_84px] items-center gap-3 md:grid-cols-[24px_minmax(0,1fr)_200px_56px_48px_40px_84px]";

const PRIMARY = "h-10 rounded-md bg-inverse px-4 text-body font-semibold text-on-inverse transition-colors duration-150 enabled:hover:bg-inverse-hover disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY = "h-10 rounded-md border border-strong px-3.5 text-body font-semibold transition-colors duration-150 enabled:hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40";
const GHOST = "h-8 rounded-[8px] px-3 text-small font-medium text-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-primary";
const ROW_BUTTON = "grid size-7 place-items-center rounded-[6px] text-muted transition-colors duration-150 enabled:hover:bg-surface-overlay enabled:hover:text-primary disabled:opacity-25";

export function GeneratingPanel(props: GeneratingPanelProps) {

	const { request, parse, filters, preview, funnel, elapsedMs, tracks, edited } = props;

	const [confirmingRegenerate, setConfirmingRegenerate] = useState<boolean>(false);
	const [saveOpen, setSaveOpen] = useState<boolean>(false);
	const [dragFrom, setDragFrom] = useState<number | null>(null);
	const [dropAt, setDropAt] = useState<number | null>(null);

	const parsing = parse.status === "loading";
	const previewing = preview.status === "loading";
	const busy = parsing || previewing;
	const hasList = funnel !== null;
	const canCancel = parsing || (previewing && !hasList);
	const showSkeleton = !hasList && (parsing || previewing);

	function regenerate() {
		if (edited) setConfirmingRegenerate(true);
		else props.onRegenerate();
	};

	function statusText(): string {
		if (parsing) return "Reading your prompt…";
		if (previewing) return hasList ? "Updating the list…" : "Building the list…";
		if (parse.status === "error" || preview.status === "error") return "Stopped";
		if (elapsedMs !== null) return `Built in ${(elapsedMs / 1000).toFixed(1)} s`;
		return "";
	};

	function drop(index: number) {
		if (dragFrom !== null) props.onMoveTrack(dragFrom, index);
		setDragFrom(null);
		setDropAt(null);
	};

	return (

		<div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3.5 px-4 pt-8 pb-24">

			<div
				className={`relative flex items-center gap-3 overflow-hidden rounded-lg border bg-surface-raised py-3 pr-2.5 pl-5 transition-colors duration-150 ${busy ? "border-accent" : "border-subtle"}`}
			>

				<p className="min-w-0 flex-1 font-display text-[18px] font-medium tracking-[-0.01em]">{request.prompt}</p>

				<p role="status" className="whitespace-nowrap text-small tabular-nums text-secondary">{statusText()}</p>

				{canCancel ? (
					<button type="button" onClick={props.onCancel} className={GHOST}>Cancel</button>
				) : (
					<button type="button" onClick={props.onNewPrompt} className={GHOST}>New prompt</button>
				)}

				{busy && (
					<div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
						<div className="absolute h-full w-1/4 animate-slide-indeterminate bg-accent" />
					</div>
				)}

			</div>

			{parse.status === "error" ? (

				<ErrorNotice title="Couldn’t read your prompt" message={parse.message}>
					<button type="button" onClick={props.onRetryParse} className={SECONDARY}>Try again</button>
					<button type="button" onClick={props.onNewPrompt} className={SECONDARY}>Edit prompt</button>
				</ErrorNotice>

			) : filters ? (

				<FilterChips
					filters={filters}
					energyRelaxed={funnel?.relaxed.includes("energy") ?? false}
					onChange={props.onFiltersChange}
				/>

			) : (

				<div className="flex flex-wrap gap-1" aria-hidden="true">
					{SKELETON_CHIP_WIDTHS.map((width) => (
						<Skeleton key={width} className={`h-[26px] rounded-sm ${width}`} />
					))}
				</div>

			)}

			{preview.status === "error" && (
				<ErrorNotice title="Couldn’t build the list" message={preview.message}>
					<button type="button" onClick={props.onRetryPreview} className={SECONDARY}>Try again</button>
				</ErrorNotice>
			)}

			{funnel && filters && !previewing && preview.status !== "error" && (
				<ShortfallNotice funnel={funnel} filters={filters} onFiltersChange={props.onFiltersChange} />
			)}

			{parse.status !== "error" && (

				<>

					<div className="flex flex-wrap items-end justify-between gap-4 pt-7">

						{hasList ? (

							<div className="flex animate-fade-up flex-col gap-1.5">
								<h1 className="font-display text-title-2 tabular-nums">{tracks.length} tracks</h1>
								<p className="text-small tabular-nums text-muted">
									{summarize(tracks)}
									{edited && " · edited"}
								</p>
							</div>

						) : (

							<div className="flex flex-col gap-3 pb-1" aria-hidden="true">
								<Skeleton className="h-6 w-[132px] rounded-sm" />
								<Skeleton className="h-2.5 w-[260px] rounded-[3px]" />
							</div>

						)}

						{confirmingRegenerate ? (

							<div role="alertdialog" aria-label="Discard your edits?" className="flex flex-wrap items-center gap-2">
								<span className="text-small text-secondary">Discard your changes to the list?</span>
								<button type="button" onClick={() => setConfirmingRegenerate(false)} className={SECONDARY}>Keep</button>
								<button
									type="button"
									autoFocus
									onClick={() => {
										setConfirmingRegenerate(false);
										props.onRegenerate();
									}}
									className={PRIMARY}
								>
									Discard and regenerate
								</button>
							</div>

						) : (

							<div className="flex gap-2">
								<button type="button" onClick={regenerate} disabled={busy || !filters} className={SECONDARY}>
									Regenerate
								</button>
								<button
									type="button"
									onClick={() => setSaveOpen(true)}
									disabled={busy || tracks.length === 0 || preview.status === "error"}
									className={PRIMARY}
								>
									Save to Tidal
								</button>
							</div>

						)}

					</div>

					{showSkeleton ? (

						<ol aria-label="Playlist tracks" aria-busy="true" className="mt-2 border-t border-subtle">
							{Array.from({ length: Math.min(request.size, MAX_SKELETON_ROWS) }, (_, i) => (
								<SkeletonRow key={i} index={i} />
							))}
						</ol>

					) : hasList && tracks.length === 0 ? (

						<p className="mt-2 border-t border-subtle pt-8 text-center text-body text-secondary">
							{edited ? "You removed every track." : "Nothing to show."}
						</p>

					) : hasList && (

						<ol
							aria-label="Playlist tracks"
							aria-busy={previewing}
							className={`mt-2 border-t border-subtle transition-opacity duration-150 ${previewing ? "opacity-50" : ""}`}
						>
							{tracks.map((track, i) => (
								<TrackRow
									key={track.isrc}
									track={track}
									index={i}
									count={tracks.length}
									dropTarget={dropAt === i && dragFrom !== i}
									onRemove={() => props.onRemoveTrack(i)}
									onMove={(to) => props.onMoveTrack(i, to)}
									onDragStart={() => setDragFrom(i)}
									onDragOver={() => setDropAt(i)}
									onDragEnd={() => {
										setDragFrom(null);
										setDropAt(null);
									}}
									onDrop={() => drop(i)}
								/>
							))}
						</ol>

					)}

				</>

			)}

			{filters && (
				<SaveDialog
					open={saveOpen}
					onClose={() => setSaveOpen(false)}
					prompt={request.prompt}
					filters={filters}
					tracks={tracks}
				/>
			)}

		</div>

	);

};

function ErrorNotice({ title, message, children }: { title: string; message: string; children: ReactNode }) {

	return (

		<div role="alert" className="flex animate-fade-up flex-wrap items-center gap-4 rounded-md border border-danger/45 bg-danger-soft px-4 py-3">

			<TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-body font-semibold">{title}</p>
				<p className="text-small text-secondary">{message}</p>
			</div>

			<div className="flex gap-2">{children}</div>

		</div>

	);

};

function shortfallMessage(funnel: FunnelStats): { text: string; culprit: FunnelStats["steps"][number] | null } {

	const { libraryTotal, steps, dropped, selected, requested } = funnel;
	const relaxedEnergy = funnel.relaxed.includes("energy");
	const relaxedNote = relaxedEnergy ? " The energy range was already ignored to find more." : "";

	if (selected >= requested) {
		return { text: "Too few tracks matched the energy range, so it was ignored.", culprit: null };
	};

	if (libraryTotal < requested) {
		return { text: `Your library has ${libraryTotal} recordings, fewer than the ${requested} requested.`, culprit: null };
	};

	const culprit = steps.find((step) => step.count < requested) ?? null;

	if (culprit) {

		const matched = culprit.count === 0
			? `No recordings match ${culprit.label}.`
			: `Only ${culprit.count} recordings match ${culprit.label}, so the list has ${selected} of ${requested}.`;

		return { text: matched + relaxedNote, culprit };

	};

	if (dropped) {
		return {
			text: `${selected + dropped} tracks matched, but ${dropped} were left out to keep at most two per artist and skip duplicates.${relaxedNote}`,
			culprit: null,
		};
	};

	return { text: `Only ${selected} of ${requested} tracks matched.${relaxedNote}`, culprit: null };

};

function ShortfallNotice({ funnel, filters, onFiltersChange }: {
	funnel: FunnelStats;
	filters: ParsedPrompt;
	onFiltersChange: (next: ParsedPrompt) => void;
}) {

	const short = funnel.selected < funnel.requested;
	if (!short && !funnel.relaxed.includes("energy")) return null;

	const { text, culprit } = shortfallMessage(funnel);

	return (

		<div className="flex animate-fade-up flex-wrap items-center gap-3 rounded-md border border-subtle bg-surface-raised px-4 py-3">

			<TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />

			<p className="min-w-0 flex-1 text-small tabular-nums text-secondary">{text}</p>

			{culprit && culprit.filters.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{culprit.filters.map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => onFiltersChange(removeFilter(filters, key))}
							className="h-8 rounded-md border border-strong px-3 text-small font-semibold transition-colors duration-150 hover:bg-surface-overlay"
						>
							Remove {describeFilter(filters, key)}
						</button>
					))}
				</div>
			)}

		</div>

	);

};

function summarize(tracks: TrackResult[]): string {

	const totalS = tracks.reduce((sum, t) => sum + (t.durationS ?? 0), 0);
	const parts = [formatTotal(totalS)];

	if (tracks.length > 0) {
		const avg = tracks.reduce((sum, t) => sum + t.energy, 0) / tracks.length;
		parts.push(`avg energy ${avg.toFixed(1)}`);
	};

	return parts.join(" · ");

};

type TrackRowProps = {
	track: TrackResult;
	index: number;
	count: number;
	dropTarget: boolean;
	onRemove: () => void;
	onMove: (to: number) => void;
	onDragStart: () => void;
	onDragOver: () => void;
	onDragEnd: () => void;
	onDrop: () => void;
};

function TrackRow({ track, index, count, dropTarget, onRemove, onMove, onDragStart, onDragOver, onDragEnd, onDrop }: TrackRowProps) {

	const position = index + 1;

	return (

		<li
			draggable
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", track.isrc);
				onDragStart();
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				onDragOver();
			}}
			onDragEnd={onDragEnd}
			onDrop={(e) => {
				e.preventDefault();
				onDrop();
			}}
			className={`group ${ROW_GRID} h-14 animate-fade-up cursor-grab border-b px-2 active:cursor-grabbing ${dropTarget ? "border-b-accent" : "border-subtle"}`}
			style={{ animationDelay: `${Math.min(index, MAX_SKELETON_ROWS) * 60}ms` }}
		>

			<span className="text-right font-mono text-caption font-normal tabular-nums text-muted">
				{String(position).padStart(2, "0")}
			</span>

			<div className="flex min-w-0 flex-col gap-0.5">

				<p className="truncate text-body font-semibold">{track.title}</p>

				<p className="flex min-w-0 items-center gap-2 text-small text-secondary">

					<span className="truncate">{track.artist ?? "Unknown artist"}</span>

					{track.confidence === "low" && (
						<span
							title="The tagger was unsure about this recording"
							className="inline-flex flex-none items-center gap-1 text-caption font-normal text-muted"
						>
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeDasharray="3 3.2" aria-hidden="true">
								<circle cx="12" cy="12" r="9" />
							</svg>
							low confidence
						</span>
					)}

				</p>

			</div>

			<div className="flex gap-1 overflow-hidden max-md:hidden">
				{track.moods.map((mood) => (
					<span
						key={mood}
						className="inline-flex h-[22px] flex-none items-center rounded-sm bg-surface-overlay px-2 text-caption text-secondary"
					>
						{mood}
					</span>
				))}
			</div>

			<div className="max-md:hidden">
				<EnergyMeter energy={track.energy} />
			</div>

			<span className="text-right text-small tabular-nums text-secondary">
				{track.durationS !== null ? formatDuration(track.durationS) : "—"}
			</span>

			<span title="Similarity to your prompt" className="text-right text-small tabular-nums text-secondary max-md:hidden">
				{(1 - track.distance).toFixed(2)}
			</span>

			<div className="flex justify-end transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
				<button type="button" aria-label={`Move ${track.title} up`} disabled={index === 0} onClick={() => onMove(index - 1)} className={ROW_BUTTON}>
					<ChevronUp size={14} strokeWidth={2.2} aria-hidden="true" />
				</button>
				<button type="button" aria-label={`Move ${track.title} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)} className={ROW_BUTTON}>
					<ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
				</button>
				<button type="button" aria-label={`Remove ${track.title}`} onClick={onRemove} className={ROW_BUTTON}>
					<X size={14} strokeWidth={2.2} aria-hidden="true" />
				</button>
			</div>

		</li>

	);

};

function EnergyMeter({ energy }: { energy: number }) {

	return (

		<span role="img" aria-label={`Energy ${energy} of 5`} className="flex items-end gap-[5px]">

			<span aria-hidden="true" className="flex h-3 items-end gap-0.5">
				{ENERGY_BAR_HEIGHTS.map((height, i) => (
					<span
						key={height}
						className={`block w-[3px] rounded-[1px] ${i < energy ? "bg-primary" : "bg-surface-strong"}`}
						style={{ height }}
					/>
				))}
			</span>

			<span aria-hidden="true" className="text-caption leading-none tabular-nums text-secondary">{energy}</span>

		</span>

	);

};

function SkeletonRow({ index }: { index: number }) {

	const delay = { animationDelay: `${index * 60}ms` };

	return (

		<li className={`${ROW_GRID} h-14 border-b border-subtle px-2`} aria-hidden="true">

			<Skeleton className="h-2 rounded-[3px]" style={delay} />

			<div className="flex flex-col gap-1.5">
				<Skeleton className={`h-2.5 rounded-[3px] ${SKELETON_TITLE_WIDTHS[index % SKELETON_TITLE_WIDTHS.length]}`} style={delay} />
				<span className={`h-2 rounded-[3px] bg-surface-raised ${SKELETON_ARTIST_WIDTHS[index % SKELETON_ARTIST_WIDTHS.length]}`} />
			</div>

			<div className="flex gap-1 max-md:hidden">
				<span className="h-5 w-[60px] rounded-sm bg-surface-raised" />
				<span className="h-5 w-12 rounded-sm bg-surface-raised" />
			</div>

			<span className="max-md:hidden" />
			<span />
			<span className="max-md:hidden" />
			<span />

		</li>

	);

};

function Skeleton({ className, style }: { className: string; style?: CSSProperties }) {
	return <span aria-hidden="true" className={`block animate-skeleton bg-surface-overlay ${className}`} style={style} />;
};

function formatDuration(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function formatTotal(seconds: number): string {

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.round((seconds % 3600) / 60);

	return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;

};
