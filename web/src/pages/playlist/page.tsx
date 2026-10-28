import { useEffect, useRef, useState } from "react";
import { PromptPanel } from "./PromptPanel";
import { GeneratingPanel } from "./GeneratingPanel";
import { mockGenerate } from "./mock";
import type { GenerationProgress } from "./types";

export type GenerationOptions = {
	maxTracks: number;
};

export type GenerationRequest = { prompt: string; size: number };

type Phase =
	| { status: "idle" }
	| { status: "active"; request: GenerationRequest; progress: GenerationProgress }
	| { status: "error"; request: GenerationRequest; message: string };

export const MIN_TRACKS = 1;
export const MAX_TRACKS = 1_000;

export default function PlaylistPage() {

	const [phase, setPhase] = useState<Phase>({ status: "idle" });
	const [prompt, setPrompt] = useState<string>("");
	const [options, setOptions] = useState<GenerationOptions>({
		maxTracks: 25,
	});

	const controllerRef = useRef<AbortController | null>(null);

	useEffect(() => () => controllerRef.current?.abort(), []);

	const canSubmit = prompt.trim() !== "";

	function decreaseMaxTracks() {
		setOptions((prev) => ({ ...prev, maxTracks: Math.max(MIN_TRACKS, prev.maxTracks - 1) }));
	};

	function increaseMaxTracks() {
		setOptions((prev) => ({ ...prev, maxTracks: Math.min(MAX_TRACKS, prev.maxTracks + 1) }));
	};

	function generate() {
		if (!canSubmit) return;
		run({ prompt: prompt.trim(), size: options.maxTracks });
	};

	function cancel() {
		setPhase({ status: "idle" });
	};

	async function run(request: GenerationRequest) {

		controllerRef.current?.abort();

		const controller = new AbortController();
		controllerRef.current = controller;

		try {

			await mockGenerate(
				request,
				(progress) => setPhase({ status: "active", request, progress }),
				controller.signal,
			);

		} catch (err) {
			if (controller.signal.aborted) return;
			setPhase({ status: "error", request, message: err instanceof Error ? err.message : String(err) });
		};

	};

	function stop() {
		controllerRef.current?.abort();
		setPhase({ status: "idle" });
	};

	function renderPhase() {

		switch (phase.status) {

			case "idle":

				return (

					<PromptPanel
						prompt={prompt}
						onPromptChange={setPrompt}
						maxTracks={options.maxTracks}
						onDecrease={decreaseMaxTracks}
						onIncrease={increaseMaxTracks}
						canSubmit={canSubmit}
						onSubmit={generate}
					/>

				);

			case "active":

				return (

					<GeneratingPanel
						request={phase.request}
						progress={phase.progress}
						onStop={stop}
						onRegenerate={() => run(phase.request)}
					/>

				);

			default:
				return null;

		};

	};

	return (

		<div className="flex w-full flex-1 flex-col items-center">
			{renderPhase()}
		</div>

	);

};