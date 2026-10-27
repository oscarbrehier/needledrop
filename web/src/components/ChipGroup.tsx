export type ChipValue = { value: string; count: number };

export function ChipGroup({
	label,
	hint,
	values,
	selected,
	onToggle,
	onClear
}: {
	label: string;
	hint?: string;
	values: ChipValue[];
	selected: Set<string>;
	onToggle: (value: string) => void;
	onClear: () => void;
}) {

	return (


		<div className="mb-6">

			<div className="mb-2 flex items-center gap-3 text-xs text-stone-500">

				<span className="font-medium uppercase tracking-wide">{label}</span>
				{hint && <span>{hint}</span>}

				{selected.size > 0 && (
					<button
						type="button"
						onClick={onClear}
						className="underline hover:text-stone-800"
					>
						Clear
					</button>
				)}

			</div>

			<div className="flex flex-wrap gap-1">

				{values.map(({ value, count }) => {

					const isSelected = selected.has(value);

					return (
						<button
							key={value}
							type="button"
							aria-pressed={isSelected}
							onClick={() => onToggle(value)}
							className={`rounded-md px-2 py-1 text-sm ${isSelected
								? "bg-stone-800 text-white"
								: "bg-stone-200 text-stone-700 hover:bg-stone-300"
								}`}
						>
							{value} <span className="opacity-60">{count}</span>
						</button>
					);

				})}

			</div>

		</div>

	);

};