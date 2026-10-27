import type { Confidence, Recording } from "../pages/library/page";

const CONFIDENCE_STYLES: Record<Confidence, string> = {
	high: "bg-emerald-100 text-emerald-800",
	medium: "bg-amber-100 text-amber-800",
	low: "bg-red-100 text-red-800",
};

type RecordingRowProps = {
	recording: Recording;
};

export function RecordingRow({ recording }: RecordingRowProps) {

	const { title, artist, tags } = recording;

	return (

		<tr className="align-top hover:bg-stone-50">

			<td className="px-4 py-2">
				<div className="font-medium">{title}</div>
				{tags?.description && (
					<div className="mt-0.5 line-clamp-2 text-xs text-stone-500">{tags.description}</div>
				)}
			</td>

			<td className="px-4 py-2 text-stone-600">{artist ?? "—"}</td>
			<td className="px-4 py-2">{tags?.moods.join(", ") ?? <Muted />}</td>
			<td className="px-4 py-2 tabular-nums">{tags?.energy ?? <Muted />}</td>
			<td className="px-4 py-2">
				{tags ? (
					<span
						className={`rounded px-1.5 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[tags.confidence]}`}
					>
						{tags.confidence}
					</span>
				) : (
					<Muted />
				)}
			</td>

			<td className="px-4 py-2">{tags?.languages.join(", ") ?? <Muted />}</td>

		</tr>

	);
	
};

function Muted() {
	return <span className="text-stone-400">—</span>;
};