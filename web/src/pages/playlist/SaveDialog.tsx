import { ExternalLink, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../../api";
import type { ParsedPrompt, SaveResponse, TrackResult } from "@contract";

type SaveState =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "error"; message: string }
	| { status: "done"; result: SaveResponse };

type SaveDialogProps = {
	open: boolean;
	onClose: () => void;
	prompt: string;
	filters: ParsedPrompt;
	tracks: TrackResult[];
};

const PRIMARY = "h-10 rounded-md bg-inverse px-4 text-body font-semibold text-on-inverse transition-colors duration-150 enabled:hover:bg-inverse-hover disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY = "h-10 rounded-md border border-strong px-3.5 text-body font-semibold transition-colors duration-150 enabled:hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40";

export function SaveDialog({ open, onClose, prompt, filters, tracks }: SaveDialogProps) {

	const dialogRef = useRef<HTMLDialogElement>(null);
	const [name, setName] = useState<string>("");
	const [state, setState] = useState<SaveState>({ status: "idle" });

	const saving = state.status === "saving";

	useEffect(() => {

		const dialog = dialogRef.current;
		if (!dialog) return;

		if (open && !dialog.open) {
			setName("");
			setState({ status: "idle" });
			dialog.showModal();
		};

		if (!open && dialog.open) dialog.close();

	}, [open]);

	function close() {
		if (!saving) onClose();
	};

	async function save() {

		setState({ status: "saving" });

		try {

			const result = await api.savePlaylist({
				name: name.trim() || undefined,
				prompt,
				filters,
				isrcs: tracks.map((t) => t.isrc),
			});

			setState({ status: "done", result });

		} catch (err) {
			setState({ status: "error", message: api.errorMessage(err) });
		};

	};

	return (

		<dialog
			ref={dialogRef}
			aria-labelledby="save-dialog-title"
			onCancel={(e) => {
				e.preventDefault();
				close();
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) close();
			}}
			className="m-auto w-[min(460px,calc(100%-32px))] rounded-lg border border-subtle bg-surface-raised p-0 text-primary backdrop:bg-scrim"
		>

			{state.status === "done" ? (

				<div className="flex flex-col gap-4 p-6">

					<h2 id="save-dialog-title" className="font-display text-title-3">Saved to Tidal</h2>

					<p className="text-body text-secondary">
						“{state.result.name}” now has {state.result.trackCount} tracks.
					</p>

					<div className="flex justify-end gap-2 pt-2">
						<button type="button" onClick={onClose} className={SECONDARY}>Done</button>
						<a
							href={state.result.url}
							target="_blank"
							rel="noreferrer"
							className={`${PRIMARY} inline-flex items-center gap-2`}
						>
							Open in Tidal
							<ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
						</a>
					</div>

				</div>

			) : (

				<form
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
					className="flex flex-col gap-4 p-6"
				>

					<div className="flex flex-col gap-1">
						<h2 id="save-dialog-title" className="font-display text-title-3">Save to Tidal</h2>
						<p className="text-small tabular-nums text-muted">{tracks.length} tracks, in the order shown.</p>
					</div>

					<label className="flex flex-col gap-1.5">
						<span className="text-small font-medium text-secondary">Name</span>
						<input
							type="text"
							value={name}
							maxLength={100}
							disabled={saving}
							placeholder="Leave empty to name it after the prompt"
							onChange={(e) => setName(e.target.value)}
							className="h-10 rounded-md border border-subtle bg-surface px-3 text-body text-primary outline-none transition-colors duration-150 focus:border-emphasis disabled:opacity-60"
						/>
					</label>

					{state.status === "error" && (

						<p role="alert" className="flex items-start gap-2 rounded-md border border-danger/45 bg-danger-soft px-3 py-2.5 text-small text-primary">
							<TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
							<span>{state.message}</span>
						</p>

					)}

					<div className="flex justify-end gap-2 pt-2">
						<button type="button" onClick={close} disabled={saving} className={SECONDARY}>Cancel</button>
						<button type="submit" disabled={saving} className={PRIMARY}>
							{saving ? "Saving…" : state.status === "error" ? "Retry" : "Save"}
						</button>
					</div>

				</form>

			)}

		</dialog>

	);

};
