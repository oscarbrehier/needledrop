import process from "node:process";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { modelCacheDir } from "../config.js";

env.cacheDir = modelCacheDir;

const MODEL = "Xenova/bge-m3";
export const DIMENSIONS = 1024;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

// transformers.js (4.3.0) leaks model file errors as unhandled rejections instead
// of rejecting pipeline(): session.js only awaits the core .onnx promise after the
// external data has loaded, and model-loader.js loads each .onnx_data chunk inside an
// async Promise executor. A missing or undownloadable file therefore crashes the
// process, and pipeline() never settles. While loading, those rejections are routed
// to the pending load so embed() rejects normally; late duplicates from a load that
// already failed are only logged. Any other unhandled rejection is re-raised, as Node
// would by default.
let failPendingLoad: ((error: unknown) => void) | undefined;
let listening = false;

function fromTransformers(reason: unknown): boolean {
	return reason instanceof Error && /@huggingface[\\/]transformers/.test(reason.stack ?? "");
};

function onUnhandledRejection(reason: unknown) {
	if (!fromTransformers(reason)) {
		process.nextTick(() => { throw reason; });
		return;
	};
	if (failPendingLoad) failPendingLoad(reason);
	else console.warn(`Ignoring a late error from a failed model load: ${(reason as Error).message}`);
};

async function loadExtractor(): Promise<FeatureExtractionPipeline> {

	if (!listening) {
		process.on("unhandledRejection", onUnhandledRejection);
		listening = true;
	};

	const leaked = new Promise<never>((_, reject) => { failPendingLoad = reject; });

	try {
		return await Promise.race([pipeline("feature-extraction", MODEL), leaked]);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not load the ${MODEL} embedding model (MODEL_CACHE_DIR=${modelCacheDir}): ${detail}`, { cause: error });
	} finally {
		failPendingLoad = undefined;
	};

};

function getExtractor(): Promise<FeatureExtractionPipeline> {
	extractor ??= loadExtractor().catch((error: unknown) => {
		extractor = undefined;
		throw error;
	});
	return extractor;
};

export async function embed(texts: string[]): Promise<Float32Array[]> {

	const model = await getExtractor();
	const output = await model(texts, { pooling: "cls", normalize: true });
	const vectors = output.tolist() as number[][];

	return vectors.map((vector) => new Float32Array(vector));

};
