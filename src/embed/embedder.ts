import process from "node:process";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import { modelCacheDir } from "../config.js";

env.cacheDir = modelCacheDir;

const MODEL = "Xenova/bge-m3";
export const DIMENSIONS = 1024;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

// Rejects the load in progress; set only while loadExtractor() is waiting.
let failPendingLoad: ((error: unknown) => void) | undefined;
let listening = false;

function fromTransformers(reason: unknown): boolean {
	return reason instanceof Error && /@huggingface[\\/]transformers/.test(reason.stack ?? "");
};

// Works around a bug in @huggingface/transformers 4.3.0 (pinned in package.json):
// a model file that is missing or fails to download never rejects pipeline().
//  - src/models/session.js starts getCoreModelFile() but only awaits it after
//    getModelDataFiles(), so a failed .onnx load rejects with no handler attached.
//  - src/utils/model-loader.js loads each .onnx_data chunk inside
//    `new Promise(async (resolve, reject) => ...)`, so a throw there escapes the
//    executor and that promise never settles.
// Both surface as unhandled rejections, which crash Node by default, while
// pipeline() hangs forever. bge-m3 uses external data, so it hits both.
// This handler routes rejections from transformers.js to the pending load so
// embed() rejects normally. A late duplicate from a load that already failed is
// only logged. Anything else is re-thrown, which keeps Node's default crash.
// Before upgrading the library, check whether both spots are fixed; if so, drop
// this handler and loadExtractor()'s race.
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
