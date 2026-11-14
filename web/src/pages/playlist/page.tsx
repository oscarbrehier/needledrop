import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../api";
import { PromptPanel } from "./PromptPanel";
import { GeneratingPanel } from "./GeneratingPanel";
import type { FunnelStats, LibraryStats, ParsedPrompt, ParseRequest, TrackResult } from "@contract";

export type CallState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "done" };

export type StatsState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "done"; data: LibraryStats };

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 100;

const IDLE: CallState = { status: "idle" };

export default function PlaylistPage() {

	const [prompt, setPrompt] = useState<string>("");
	const [size, setSize] = useState<number>(25);
	const [stats, setStats] = useState<StatsState>({ status: "loading" });

	const [request, setRequest] = useState<ParseRequest | null>(null);
	const [parse, setParse] = useState<CallState>(IDLE);
	const [filters, setFilters] = useState<ParsedPrompt | null>(null);
	const [preview, setPreview] = useState<CallState>(IDLE);
	const [funnel, setFunnel] = useState<FunnelStats | null>(null);
	const [elapsedMs, setElapsedMs] = useState<number | null>(null);
	const [tracks, setTracks] = useState<TrackResult[]>([]);
	const [edited, setEdited] = useState<boolean>(false);

	const parseController = useRef<AbortController | null>(null);
	const previewController = useRef<AbortController | null>(null);

	const loadStats = useCallback((signal?: AbortSignal) => {

		api.getLibraryStats(signal)
			.then((data) => setStats({ status: "done", data }))
			.catch((err) => {
				if (signal?.aborted) return;
				setStats({ status: "error", message: api.errorMessage(err) });
			});

	}, []);

	useEffect(() => {
		const controller = new AbortController();
		loadStats(controller.signal);
		return () => controller.abort();
	}, [loadStats]);

	useEffect(() => () => {
		parseController.current?.abort();
		previewController.current?.abort();
	}, []);

	function abortAll() {
		parseController.current?.abort();
		previewController.current?.abort();
	};

	async function runPreview(next: ParsedPrompt, startedAt = performance.now()) {

		previewController.current?.abort();

		const controller = new AbortController();
		previewController.current = controller;

		setPreview({ status: "loading" });

		try {

			const result = await api.preview(next, controller.signal);
			if (controller.signal.aborted) return;

			setTracks(result.tracks);
			setFunnel(result.stats);
			setEdited(false);
			setElapsedMs(performance.now() - startedAt);
			setPreview({ status: "done" });

		} catch (err) {
			if (controller.signal.aborted) return;
			setPreview({ status: "error", message: api.errorMessage(err) });
		};

	};

	async function generate(req: ParseRequest) {

		abortAll();

		const controller = new AbortController();
		parseController.current = controller;
		const startedAt = performance.now();

		setRequest(req);
		setFilters(null);
		setTracks([]);
		setFunnel(null);
		setEdited(false);
		setElapsedMs(null);
		setPreview(IDLE);
		setParse({ status: "loading" });

		let parsed: ParsedPrompt;

		try {
			parsed = await api.parsePrompt(req, controller.signal);
		} catch (err) {
			if (controller.signal.aborted) return;
			setParse({ status: "error", message: api.errorMessage(err) });
			return;
		};

		if (controller.signal.aborted) return;

		setParse({ status: "done" });
		setFilters(parsed);
		void runPreview(parsed, startedAt);

	};

	function submit() {
		const trimmed = prompt.trim();
		if (trimmed === "") return;
		void generate({ prompt: trimmed, size });
	};

	function backToPrompt() {
		abortAll();
		setRequest(null);
		setParse(IDLE);
		setPreview(IDLE);
	};

	function changeFilters(next: ParsedPrompt) {
		setFilters(next);
		void runPreview(next);
	};

	function rerunPreview() {
		if (filters) void runPreview(filters);
	};

	function removeTrack(index: number) {
		setTracks((prev) => prev.filter((_, i) => i !== index));
		setEdited(true);
	};

	function moveTrack(from: number, to: number) {

		if (from === to) return;

		setTracks((prev) => {
			if (to < 0 || to >= prev.length) return prev;
			const next = [...prev];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved!);
			return next;
		});

		setEdited(true);

	};

	if (request === null) {

		return (

			<div className="flex w-full flex-1 flex-col items-center">
				<PromptPanel
					prompt={prompt}
					onPromptChange={setPrompt}
					size={size}
					onDecrease={() => setSize((s) => Math.max(MIN_TRACKS, s - 1))}
					onIncrease={() => setSize((s) => Math.min(MAX_TRACKS, s + 1))}
					canSubmit={prompt.trim() !== ""}
					onSubmit={submit}
					stats={stats}
					onRetryStats={() => {
						setStats({ status: "loading" });
						loadStats();
					}}
				/>
			</div>

		);

	};

	return (

		<div className="flex w-full flex-1 flex-col items-center">
			<GeneratingPanel
				request={request}
				parse={parse}
				filters={filters}
				preview={preview}
				funnel={funnel}
				elapsedMs={elapsedMs}
				tracks={tracks}
				edited={edited}
				onCancel={backToPrompt}
				onNewPrompt={backToPrompt}
				onRetryParse={() => void generate(request)}
				onFiltersChange={changeFilters}
				onRetryPreview={rerunPreview}
				onRegenerate={rerunPreview}
				onRemoveTrack={removeTrack}
				onMoveTrack={moveTrack}
			/>
		</div>

	);

};
