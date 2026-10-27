import { ArrowUp } from "lucide-react";
import { MAX_TRACKS, MIN_TRACKS } from "./page";

const SUGGESTIONS = [
	"late-night jazz for cooking",
	"upbeat French pop for a road trip",
	"instrumental focus, low energy",
	"melancholic indie, English only",
	"soft electronic for a slow morning",
];

type PromptPanelProps = {
	prompt: string;
	onPromptChange: (value: string) => void;
	maxTracks: number;
	onDecrease: () => void;
	onIncrease: () => void;
	canSubmit: boolean;
	onSubmit: () => void;
}

export function PromptPanel({
	prompt,
	onPromptChange,
	maxTracks,
	onDecrease,
	onIncrease,
	canSubmit,
	onSubmit,
}: PromptPanelProps) {

	return (

		<div className="mt-60 w-full flex flex-col items-center space-y-10">

			<div className="text-center space-y-2">
				<p className="text-6xl font-display font-semibold tracking-tight">What should we play?</p>
				<p className="text-muted">Drawn from your X recordings.</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
				className="w-full max-w-3xl bg-surface-raised rounded-lg px-6 py-4 space-y-12 flex flex-col justify-between border border-subtle"
			>

				<input
					type="text"
					placeholder="Laboris consequat laborum ea commodo."
					className="font-display text-xl placeholder:text-muted mt-2 outline-none border-none"
					value={prompt}
					onChange={(e) => onPromptChange(e.target.value)}
				/>

				<div className="w-full flex items-end justify-between">

					<div className="flex h-10 items-center space-x-2 rounded-md border border-subtle">

						<button
							type="button"
							aria-label="Fewer tracks"
							onClick={onDecrease}
							disabled={maxTracks <= MIN_TRACKS}
							className="disabled:opacity-30 size-10 rounded-md transition-colors text-muted hover:text-primary hover:bg-surface-overlay"
						>
							-
						</button>

						<p className="text-muted text-sm" aria-live="polite">
							<span className="font-semibold text-primary tabular-nums">{maxTracks}</span>{" "}
							tracks
						</p>

						<button
							type="button"
							aria-label="More tracks"
							onClick={onIncrease}
							disabled={maxTracks >= MAX_TRACKS}
							className="disabled:opacity-30 size-10 rounded-md transition-colors text-muted hover:text-primary hover:bg-surface-overlay"
						>
							+
						</button>

					</div>

					<button
						type="submit"
						aria-label="Generate playlist"
						disabled={!canSubmit}
						className="flex size-10 items-center justify-center rounded-md bg-inverse transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ArrowUp className="text-on-inverse" size={18} strokeWidth={2} aria-hidden="true" />
					</button>

				</div>

			</form>

			<div className="w-full max-w-4xl flex flex-wrap justify-center gap-3">

				{SUGGESTIONS.slice(0, 5).map((v) => (

					<button
						key={v}
						className="py-2 px-4 rounded-full border border-subtle transition-colors text-secondary text-sm hover:bg-subtle hover:text-primary"
						onClick={() => onPromptChange(v)}
					>
						{v}
					</button>

				))}

			</div>

		</div>

	);

};