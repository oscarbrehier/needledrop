import { TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import type {
	GenerationProgress,
	GenerationRequest,
	GenerationResult,
	ParsedPrompt,
	PlaylistTrack,
} from "./types";

type GeneratingPanelProps = {
	request: GenerationRequest;
	progress: GenerationProgress;
	onStop: () => void;
	onRegenerate: () => void;
};

const STATUS_TEXT: Record<"reading" | "building", string> = {
	reading: "Reading your prompt…",
	building: "Building the list…",
};

const MAX_SKELETON_ROWS = 8;
const ENERGY_BAR_HEIGHTS = [4, 6, 8, 10, 12];
const SKELETON_CHIP_WIDTHS = ["w-[58px]", "w-[84px]", "w-[44px]", "w-[150px]", "w-[70px]"];
const SKELETON_TITLE_WIDTHS = ["w-[46%]", "w-[38%]", "w-[52%]", "w-[34%]", "w-[44%]", "w-[40%]", "w-[48%]", "w-[36%]"];
const SKELETON_ARTIST_WIDTHS = ["w-[24%]", "w-[28%]", "w-[20%]", "w-[22%]", "w-[26%]", "w-[18%]", "w-[24%]", "w-[22%]"];
const ROW_GRID = "grid grid-cols-[24px_minmax(0,1fr)_48px] items-center gap-3 md:grid-cols-[24px_minmax(0,1fr)_200px_56px_48px_40px]";

export function GeneratingPanel({ request, progress, onStop, onRegenerate }: GeneratingPanelProps) {

	const done = progress.stage === "done";
	const parsed = progress.stage === "reading" ? null : progress.parsed;
	const result = progress.stage === "done" ? progress.result : null;

	return (

		<div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3.5 px-4 pt-8 pb-24">

			<div
				className={`relative flex items-center gap-3 overflow-hidden rounded-lg border bg-surface-raised py-3 pr-2.5 pl-5 transition-colors duration-150 ${done ? "border-subtle" : "border-accent"
					}`}
			>

				<p className="min-w-0 flex-1 font-display text-[18px] font-medium tracking-[-0.01em]">{request.prompt}</p>

				<p role="status" className="whitespace-nowrap text-small tabular-nums text-secondary">
					{progress.stage === "done"
						? `Built in ${(progress.result.elapsedMs / 1000).toFixed(1)} s`
						: STATUS_TEXT[progress.stage]}
				</p>

				{!done && (
					<button
						type="button"
						onClick={onStop}
						className="h-8 rounded-[8px] px-3 text-small font-medium text-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-primary"
					>
						Stop
					</button>
				)}

				{!done && (
					<div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
						<div className="absolute h-full w-1/4 animate-slide-indeterminate bg-accent" />
					</div>
				)}

			</div>

			{parsed ? (

				<div role="group" aria-label="Understood as" className="flex animate-fade-up flex-wrap gap-1">
					{describeParsed(parsed).map((chip) => (
						<span
							key={chip}
							className="inline-flex h-[26px] items-center rounded-sm bg-surface-overlay px-[9px] text-small tabular-nums text-secondary"
						>
							{chip}
						</span>
					))}
				</div>

			) : (

				<div className="flex flex-wrap gap-1" aria-hidden="true">
					{SKELETON_CHIP_WIDTHS.map((width) => (
						<Skeleton key={width} className={`h-[26px] rounded-sm ${width}`} />
					))}
				</div>

			)}

			{result && <ShortfallNotice request={request} result={result} />}

			<div className="flex flex-wrap items-end justify-between gap-4 pt-7">

				{result ? (

					<div className="flex animate-fade-up flex-col gap-1.5">
						<h1 className="font-display text-title-2 tabular-nums">{result.tracks.length} tracks</h1>
						<p className="text-small tabular-nums text-muted">{summarize(result.tracks)}</p>
					</div>

				) : (

					<div className="flex flex-col gap-3 pb-1" aria-hidden="true">
						<Skeleton className="h-6 w-[132px] rounded-sm" />
						<Skeleton className="h-2.5 w-[260px] rounded-[3px]" />
					</div>

				)}

				<div className="flex gap-2">

					<button
						type="button"
						onClick={onRegenerate}
						disabled={!done}
						className="h-10 rounded-md border border-strong px-3.5 text-body font-semibold transition-colors duration-150 enabled:hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40"
					>
						Regenerate
					</button>

					<button
						type="button"
						disabled={!done}
						className="h-10 rounded-md bg-inverse px-4 text-body font-semibold text-on-inverse transition-colors duration-150 enabled:hover:bg-inverse-hover disabled:cursor-not-allowed disabled:opacity-40"
					>
						Save to Tidal
					</button>

				</div>

			</div>

			<ol aria-label="Playlist tracks" aria-busy={!done} className="mt-2 border-t border-subtle">
				{result
					? result.tracks.map((track, i) => <TrackRow key={track.isrc} track={track} position={i + 1} />)
					: Array.from({ length: Math.min(request.size, MAX_SKELETON_ROWS) }, (_, i) => (
						<SkeletonRow key={i} index={i} />
					))}
			</ol>

		</div>

	);

};

function describeParsed(parsed: ParsedPrompt): string[] {

	const chips: string[] = [];
	const { language, energyMin, energyMax } = parsed.filters;

	if (language) chips.push(language);

	if (energyMin !== undefined || energyMax !== undefined) {
		chips.push(`energy ${energyMin ?? 1}–${energyMax ?? 5}`);
	};

	if (parsed.semantic) chips.push(`“${parsed.semantic}”`);

	chips.push(`${parsed.size} tracks`);

	return chips;

};

function ShortfallNotice({ request, result }: { request: GenerationRequest; result: GenerationResult }) {

	const missing = request.size - result.tracks.length;

	if (missing <= 0 && result.relaxed.length === 0) return null;

	const parts: string[] = [];

	if (missing > 0) parts.push(`Only ${result.tracks.length} of ${request.size} tracks matched.`);
	if (result.relaxed.length > 0) parts.push(`Relaxed: ${result.relaxed.join(", ")}.`);

	return (

		<p className="flex animate-fade-up items-center gap-2 rounded-md border border-subtle bg-surface-raised px-4 py-3 text-small tabular-nums text-secondary">
			<TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
			{parts.join(" ")}
		</p>

	);

};

function summarize(tracks: PlaylistTrack[]): string {

	const totalS = tracks.reduce((sum, t) => sum + (t.durationS ?? 0), 0);
	const energies = tracks.flatMap((t) => (t.energy === null ? [] : [t.energy]));
	const parts = [formatTotal(totalS)];

	if (energies.length > 0) {
		const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
		parts.push(`avg energy ${avg.toFixed(1)}`);
	};

	return parts.join(" · ");

};

function TrackRow({ track, position }: { track: PlaylistTrack; position: number }) {

	return (

		<li
			className={`${ROW_GRID} h-14 animate-fade-up border-b border-subtle px-2`}
			style={{ animationDelay: `${Math.min(position - 1, MAX_SKELETON_ROWS) * 60}ms` }}
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
				{track.energy !== null && <EnergyMeter energy={track.energy} />}
			</div>

			<span className="text-right text-small tabular-nums text-secondary">
				{track.durationS !== null ? formatDuration(track.durationS) : "—"}
			</span>

			<span title="Similarity to your prompt" className="text-right text-small tabular-nums text-secondary max-md:hidden">
				{(1 - track.distance).toFixed(2)}
			</span>

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