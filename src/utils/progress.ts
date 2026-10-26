import process from "node:process";

export type Counts = Record<string, number>;

const HEARTBEAT_MS = 5 * 60 * 1000;

function formatDuration(ms: number): string {

	if (!Number.isFinite(ms) || ms < 0) return "unknown";

	const totalMinutes = Math.round(ms / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

};

function formatCounts(counts: Counts): string {
	return Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(" ");
};

// A single in-place stderr line for live progress, plus two things that must
// never be swallowed by the \r overwrite: a timestamped heartbeat every five
// minutes (so a VPS run still looks alive after reattaching to tmux) and any
// error, each pushed to its own permanent line before progress resumes below it.
export class Progress {

	private readonly total: number;
	private readonly label: string;
	private readonly startedAt = Date.now();
	private lastHeartbeat = this.startedAt;
	private lastLineLength = 0;
	private onFreshLine = true;

	constructor(label: string, total: number) {
		this.label = label;
		this.total = total;
		process.stderr.write(`${label}: ${total} pending\n`);
	};

	private line(done: number, current: string, counts: Counts): string {

		const elapsedMs = Date.now() - this.startedAt;
		const rate = elapsedMs > 0 ? done / (elapsedMs / 60000) : 0;
		const remaining = Math.max(this.total - done, 0);
		const etaMs = rate > 0 ? (remaining / rate) * 60000 : NaN;
		const percent = this.total ? Math.round((done / this.total) * 100) : 100;

		return `${this.label}: ${done}/${this.total} (${percent}%) ${formatCounts(counts)} | ` +
			`${current} | ${rate.toFixed(1)}/min | eta ${formatDuration(etaMs)}`;

	};

	update(done: number, current: string, counts: Counts): void {

		const text = this.line(done, current, counts);

		process.stderr.write(`\r${text.padEnd(this.lastLineLength)}`);
		this.lastLineLength = text.length;
		this.onFreshLine = false;

		const now = Date.now();
		if (now - this.lastHeartbeat >= HEARTBEAT_MS) {

			this.lastHeartbeat = now;
			process.stderr.write(`\n[${new Date().toISOString()}] ${text}\n`);
			this.lastLineLength = 0;
			this.onFreshLine = true;

		};

	};

	error(message: string): void {

		if (!this.onFreshLine) process.stderr.write("\n");

		process.stderr.write(`${message}\n`);
		this.lastLineLength = 0;
		this.onFreshLine = true;

	};

	finish(): void {
		if (!this.onFreshLine) process.stderr.write("\n");
	};

};
