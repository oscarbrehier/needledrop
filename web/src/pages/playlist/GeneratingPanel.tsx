import { TriangleAlert } from "lucide-react";
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
	building: "Prompt understood, building the list…",
};

const MAX_SKELETON_ROWS = 8;

export function GeneratingPanel({ request, progress, onStop, onRegenerate }: GeneratingPanelProps) {
	const done = progress.stage === "done";
	const parsed = progress.stage === "reading" ? null : progress.parsed;
	const result = progress.stage === "done" ? progress.result : null;

	return (
		<div className="mt-20 flex w-full flex-col items-center">
			<div className="w-full max-w-5xl">
				{/* Prompt bar with status */}
				<div className="relative flex w-full items-center justify-between overflow-hidden rounded-lg border border-subtle bg-surface-raised px-8 py-4">
					<p className="font-display text-lg">{request.prompt}</p>

					<div className="flex items-center gap-6">
						<p role="status" className="text-sm text-muted">
							{progress.stage === "done"
								? `Done in ${(progress.result.elapsedMs / 1000).toFixed(1)}s`
								: STATUS_TEXT[progress.stage]}
						</p>
						{!done && (
							<button
								type="button"
								onClick={onStop}
								className="text-sm font-medium text-secondary transition-opacity hover:opacity-80"
							>
								Stop
							</button>
						)}
					</div>

					{!done && (
						<div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
							<div className="absolute h-full w-1/3 bg-accent animate-slide-indeterminate" />
						</div>
					)}
				</div>

				{/* What the prompt was understood as */}
				<div className="mt-4 flex min-h-8 flex-wrap items-center gap-2">
					{parsed ? (
						<>
							<span className="mr-1 text-sm text-muted">Understood as</span>
							{describeParsed(parsed).map((chip) => (
								<span key={chip} className="rounded-md bg-surface-overlay px-2.5 py-1.5 text-sm text-secondary">
									{chip}
								</span>
							))}
						</>
					) : (
						<>
							<Skeleton className="h-8 w-24" />
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-8 w-36" />
						</>
					)}
				</div>

				{result && <ShortfallNotice request={request} result={result} />}

				{/* Summary and actions */}
				<div className="mt-20 grid grid-cols-2">
					<div className="flex flex-col gap-2">
						{result ? (
							<>
								<p className="font-display text-4xl font-semibold">{result.tracks.length} tracks</p>
								<p className="text-secondary">{summarize(result.tracks)}</p>
							</>
						) : (
							<>
								<Skeleton className="h-10 w-40" />
								<Skeleton className="h-5 w-56" />
							</>
						)}
					</div>

					<div className="flex w-full items-end justify-end gap-2">
						<button
							type="button"
							onClick={onRegenerate}
							disabled={!done}
							className="rounded-xl border border-subtle px-6 py-3 font-medium transition-opacity disabled:opacity-40"
						>
							Regenerate
						</button>
						{/* Wired to the save dialog in item 5. */}
						<button
							type="button"
							disabled={!done}
							className="rounded-xl bg-inverse px-6 py-3 font-medium text-on-inverse transition-opacity disabled:opacity-40"
						>
							Save to Tidal
						</button>
					</div>
				</div>

				{/* Track list */}
				<ol className="mt-10" aria-busy={!done}>
					{result
						? result.tracks.map((track, i) => <TrackRow key={track.isrc} track={track} position={i + 1} />)
						: Array.from({ length: Math.min(request.size, MAX_SKELETON_ROWS) }, (_, i) => (
							<SkeletonRow key={i} />
						))}
				</ol>
			</div>
		</div>
	);
}

function describeParsed(parsed: ParsedPrompt): string[] {
	const chips: string[] = [];
	const { language, energyMin, energyMax } = parsed.filters;
	if (language) chips.push(language);
	if (energyMin !== undefined || energyMax !== undefined) {
		chips.push(`energy ${energyMin ?? 1}–${energyMax ?? 5}`);
	}
	if (parsed.semantic) chips.push(`“${parsed.semantic}”`);
	chips.push(`${parsed.size} tracks`);
	return chips;
}

function ShortfallNotice({ request, result }: { request: GenerationRequest; result: GenerationResult }) {
	const missing = request.size - result.tracks.length;
	if (missing <= 0 && result.relaxed.length === 0) return null;

	const parts: string[] = [];
	if (missing > 0) parts.push(`Only ${result.tracks.length} of ${request.size} tracks matched.`);
	if (result.relaxed.length > 0) parts.push(`Relaxed: ${result.relaxed.join(", ")}.`);

	return (
		<p className="mt-4 flex items-center gap-2 rounded-md bg-surface-overlay px-4 py-3 text-sm text-secondary">
			<TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
			{parts.join(" ")}
		</p>
	);
}

function summarize(tracks: PlaylistTrack[]): string {
	const totalS = tracks.reduce((sum, t) => sum + (t.durationS ?? 0), 0);
	const energies = tracks.flatMap((t) => (t.energy === null ? [] : [t.energy]));
	const parts = [formatTotal(totalS)];
	if (energies.length > 0) {
		const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
		parts.push(`avg energy ${avg.toFixed(1)}`);
	}
	return parts.join(" · ");
}

function TrackRow({ track, position }: { track: PlaylistTrack; position: number }) {
	return (
		<li className="grid grid-cols-2 gap-4 border-t border-subtle px-4 py-3">
			<div className="flex items-center gap-6">
				<span className="font-mono text-sm text-secondary">{String(position).padStart(2, "0")}</span>
				<div className="leading-tight">
					<p className="font-medium">{track.title}</p>
					<p className="text-secondary">{track.artist ?? "Unknown artist"}</p>
				</div>
			</div>

			<div className="flex w-full items-center justify-end gap-10">
				<div className="flex gap-2">
					{track.moods.map((mood) => (
						<span key={mood} className="rounded-md bg-surface-overlay px-2.5 py-1.5 text-sm font-medium text-muted">
							{mood}
						</span>
					))}
					{track.confidence === "low" && (
						<span
							title="The tagger was unsure about this track"
							className="rounded-md border border-subtle px-2.5 py-1.5 text-sm text-muted"
						>
							unsure
						</span>
					)}
				</div>

				{track.energy !== null && <EnergyMeter energy={track.energy} />}

				<span className="w-12 text-right font-mono text-sm text-muted">
					{track.durationS !== null ? formatDuration(track.durationS) : "—"}
				</span>
				<span className="w-10 text-right font-mono text-sm text-muted" title="Match with the prompt">
					{(1 - track.distance).toFixed(2)}
				</span>
			</div>
		</li>
	);
}

// Full class names in an array, so Tailwind finds them when it scans the source.
const BAR_HEIGHTS = ["h-1.5", "h-2", "h-2.5", "h-3", "h-3.5"];

function EnergyMeter({ energy }: { energy: number }) {
	return (
		<div className="flex items-center gap-2">
			<div className="flex items-end gap-0.5" aria-hidden="true">
				{BAR_HEIGHTS.map((height, i) => (
					<span key={height} className={`w-1 rounded-md ${height} ${i < energy ? "bg-primary" : "bg-strong"}`} />
				))}
			</div>
			<span className="font-mono text-sm text-muted">
				<span className="sr-only">Energy </span>
				{energy}
			</span>
		</div>
	);
}

function SkeletonRow() {
	return (
		<li className="grid grid-cols-2 gap-4 border-t border-subtle px-4 py-3" aria-hidden="true">
			<div className="flex items-center gap-6">
				<Skeleton className="h-4 w-5" />
				<div className="space-y-2">
					<Skeleton className="h-4 w-44" />
					<Skeleton className="h-4 w-28" />
				</div>
			</div>
			<div className="flex items-center justify-end gap-10">
				<div className="flex gap-2">
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-16" />
				</div>
				<Skeleton className="h-4 w-10" />
				<Skeleton className="h-4 w-12" />
				<Skeleton className="h-4 w-10" />
			</div>
		</li>
	);
}

function Skeleton({ className }: { className: string }) {
	return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-overlay ${className}`} />;
}

function formatDuration(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTotal(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.round((seconds % 3600) / 60);
	return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}