import { ArrowUp, Minus, Plus } from "lucide-react";
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
};

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

		<div className="flex w-full flex-1 flex-col items-center justify-center gap-8 px-4 pt-12 pb-30">

			<div className="flex animate-fade-up flex-col items-center gap-2.5 text-center">
				<h1 className="font-display text-title-1 md:text-display">What should we play?</h1>
				<p className="text-[15px] tabular-nums text-muted">Drawn from your X recordings.</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
				className="flex w-full max-w-[680px] animate-fade-up flex-col gap-4 rounded-lg border border-subtle bg-surface-raised pt-[18px] pr-3.5 pb-3 pl-5 transition-colors duration-150 [animation-delay:40ms] focus-within:border-emphasis"
			>

				<label htmlFor="playlist-prompt" className="sr-only">Describe the playlist you want</label>

				<input
					id="playlist-prompt"
					type="text"
					placeholder="mellow French songs for a rainy Sunday"
					value={prompt}
					onChange={(e) => onPromptChange(e.target.value)}
					className="w-full border-0 bg-transparent p-0 font-display text-prompt text-primary outline-none focus-visible:outline-none"
				/>

				<div className="flex items-center justify-between gap-3">

					<div role="group" aria-label="Playlist size" className="flex h-[34px] items-center rounded-md border border-subtle">

						<button
							type="button"
							aria-label="Fewer tracks"
							onClick={onDecrease}
							disabled={maxTracks <= MIN_TRACKS}
							className="grid size-8 place-items-center rounded-[9px] text-secondary transition-colors duration-150 enabled:hover:bg-surface-overlay enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
						>
							<Minus size={12} strokeWidth={2.2} aria-hidden="true" />
						</button>

						<span aria-live="polite" className="min-w-[70px] text-center text-small font-semibold tabular-nums">
							{maxTracks} <span className="font-normal text-muted">tracks</span>
						</span>

						<button
							type="button"
							aria-label="More tracks"
							onClick={onIncrease}
							disabled={maxTracks >= MAX_TRACKS}
							className="grid size-8 place-items-center rounded-[9px] text-secondary transition-colors duration-150 enabled:hover:bg-surface-overlay enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
						>
							<Plus size={12} strokeWidth={2.2} aria-hidden="true" />
						</button>

					</div>

					<button
						type="submit"
						aria-label="Generate playlist"
						disabled={!canSubmit}
						className="grid size-9 place-items-center rounded-md bg-inverse text-on-inverse transition-colors duration-150 enabled:hover:bg-inverse-hover disabled:cursor-not-allowed disabled:opacity-40"
					>
						<ArrowUp size={16} strokeWidth={2.2} aria-hidden="true" />
					</button>

				</div>

			</form>

			<div className="flex max-w-[700px] animate-fade-up flex-wrap justify-center gap-2 [animation-delay:80ms]">

				{SUGGESTIONS.map((suggestion) => (

					<button
						key={suggestion}
						type="button"
						onClick={() => onPromptChange(suggestion)}
						className="h-[34px] rounded-full border border-subtle px-3.5 text-small font-medium text-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-primary"
					>
						{suggestion}
					</button>

				))}

			</div>

		</div>

	);

};