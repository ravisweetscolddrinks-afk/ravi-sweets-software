import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { getImageEmbedding, cosineSimilarity } from "./imageMatching";

export interface MatchedProduct {
  id: string;
  name: string;
  unit: string;
  amount: number;
  imageUrl?: string;
  categoryName?: string;
  barcode?: string;
  shortCode?: string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
  similarity: number; // 0 to 100 percentage
  imageEmbedding?: number[];
  [key: string]: any;
}

/**
 * Searches and returns products most visually similar to the provided image/video frame/canvas.
 */
export async function searchSimilarProducts(
  imageSource: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData,
  limit: number = 8,
  cachedProducts?: any[]
): Promise<MatchedProduct[]> {
  // 1. Generate query embedding from the scanned image
  const queryEmbedding = await getImageEmbedding(imageSource);

  // 2. Fetch products (or use in-memory cache if provided for instant response)
  let productsList: any[] = [];
  if (cachedProducts && cachedProducts.length > 0) {
    productsList = cachedProducts;
  } else {
    const snapshot = await getDocs(collection(db, "products"));
    productsList = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  }

  // 3. Compare query embedding with stored product embeddings
  const matches = productsList
    .map((product) => {
      if (
        !product.imageEmbedding ||
        !Array.isArray(product.imageEmbedding) ||
        product.imageEmbedding.length === 0
      ) {
        return null;
      }

      const similarity = cosineSimilarity(queryEmbedding, product.imageEmbedding);

      // Scale to percentage (0 - 100)
      const similarityPct = Number((Math.max(0, similarity) * 100).toFixed(1));

      return {
        ...product,
        similarity: similarityPct,
      } as MatchedProduct;
    })
    .filter((item): item is MatchedProduct => item !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return matches;
}
