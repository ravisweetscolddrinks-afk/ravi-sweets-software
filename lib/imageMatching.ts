import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

let model: mobilenet.MobileNet | null = null;
let modelLoadingPromise: Promise<mobilenet.MobileNet> | null = null;

/**
 * Initializes and caches the MobileNet v2 model with alpha=1.0.
 */
export async function loadMobileNet(): Promise<mobilenet.MobileNet> {
  if (model) return model;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    // Ensure TensorFlow.js backend is initialized
    await tf.ready();

    const loaded = await mobilenet.load({
      version: 2,
      alpha: 1.0,
    });
    model = loaded;
    return loaded;
  })();

  return modelLoadingPromise;
}

/**
 * Extracts a 1024-dimensional feature embedding vector from an image/video/canvas element.
 */
export async function getImageEmbedding(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData
): Promise<number[]> {
  const net = await loadMobileNet();

  // infer(image, true) exposes internal feature activations (embedding vector)
  const embedding = net.infer(image, true);

  const values = await embedding.data();

  // Free tensor memory immediately to prevent WebGL/CPU memory leaks
  embedding.dispose();

  return Array.from(values);
}

/**
 * Computes cosine similarity between two 1D numeric vectors.
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for image activations).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
