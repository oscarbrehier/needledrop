import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/bge-m3";
export const DIMENSIONS = 1024;

let extractor: FeatureExtractionPipeline | undefined;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
	if (!extractor) extractor = await pipeline("feature-extraction", MODEL);
	return extractor;
};

export async function embed(texts: string[]): Promise<Float32Array[]> {

	const model = await getExtractor();
	const output = await model(texts, { pooling: "cls", normalize: true });
	const vectors = output.tolist() as number[][];

	return vectors.map((vector) => new Float32Array(vector));

};
