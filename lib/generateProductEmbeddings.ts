import { getImageEmbedding } from "./imageMatching";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

/**
 * Loads an image from a URL into an HTMLImageElement with crossOrigin support.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback attempt: append cache-busting query to avoid stale non-CORS cached responses
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = "anonymous";
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () =>
        reject(new Error("Unable to load product image for embedding: " + url));

      const sep = url.includes("?") ? "&" : "?";
      fallbackImg.src = `${url}${sep}_t=${Date.now()}`;
    };

    img.src = url;
  });
}

/**
 * Generates and stores MobileNet embeddings for all catalog products in Firestore.
 */
export async function generateAllProductEmbeddings(
  onProgress?: (done: number, total: number, currentItemName?: string) => void,
  forceRegenerate: boolean = false
): Promise<{ done: number; total: number; updatedCount: number; errors: number }> {
  const snapshot = await getDocs(collection(db, "products"));

  const total = snapshot.size;
  let done = 0;
  let updatedCount = 0;
  let errors = 0;

  for (const productDoc of snapshot.docs) {
    try {
      const product = productDoc.data();
      const productName = product.name || "Product";

      if (!product.imageUrl) {
        done++;
        onProgress?.(done, total, productName);
        continue;
      }

      // Skip products that already have embeddings unless forced
      if (!forceRegenerate && product.imageEmbedding && Array.isArray(product.imageEmbedding) && product.imageEmbedding.length > 0) {
        done++;
        onProgress?.(done, total, productName);
        continue;
      }

      onProgress?.(done, total, productName);

      const image = await loadImage(product.imageUrl);
      const embedding = await getImageEmbedding(image);

      await updateDoc(doc(db, "products", productDoc.id), {
        imageEmbedding: embedding,
        embeddingModel: "mobilenet-v2",
      });

      updatedCount++;
      done++;
      onProgress?.(done, total, productName);
    } catch (error) {
      console.error("Embedding generation failed for product:", productDoc.id, error);
      errors++;
      done++;
      onProgress?.(done, total);
    }
  }

  return { done, total, updatedCount, errors };
}

/**
 * Generates and saves embedding for a single product.
 */
export async function generateSingleProductEmbedding(
  productId: string,
  imageUrl: string
): Promise<number[]> {
  const image = await loadImage(imageUrl);
  const embedding = await getImageEmbedding(image);

  await updateDoc(doc(db, "products", productId), {
    imageEmbedding: embedding,
    embeddingModel: "mobilenet-v2",
  });

  return embedding;
}
