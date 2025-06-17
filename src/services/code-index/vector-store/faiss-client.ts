// Minimal file-based Faiss client for domain-specific vector search (no faiss-node)
// Loads vectors and texts from files at bundlePath
import * as fs from "fs/promises"

export type FaissSearchResult = {
	text: string
	score: number
}

export class FaissClient {
	private vectors: number[][] = []
	private texts: string[] = []
	private dim: number = 768
	private loaded: boolean = false

	constructor(
		private domain: string,
		private bundlePath: string,
	) {}

	// Load vectors and texts from a single file
	async load(): Promise<void> {
		console.debug(`[FaissClient] Loading vectors from '${this.bundlePath}' for domain '${this.domain}'`)
		try {
			const vectorsData = await fs.readFile(this.bundlePath, "utf-8")
			const items = JSON.parse(vectorsData)
			if (
				!Array.isArray(items) ||
				items.length === 0 ||
				typeof items[0] !== "object" ||
				!Array.isArray(items[0].embedding) ||
				typeof items[0].text !== "string"
			) {
				throw new Error("Invalid vectors format")
			}
			this.vectors = items.map((item) => item.embedding)
			this.texts = items.map((item) => item.text)
			this.dim = this.vectors[0].length
			console.debug(
				`[FaissClient] Loaded ${this.vectors.length} vectors (dim=${this.dim}) for domain '${this.domain}'`,
			)
		} catch (err) {
			console.debug(`[FaissClient] Failed to load vectors from '${this.bundlePath}': ${err}`)
			throw new Error(`Failed to load vectors from '${this.bundlePath}': ${err}`)
		}
		this.loaded = true
		console.debug(`[FaissClient] Finished loading for domain '${this.domain}'`)
	}

	// Simple L2 distance
	private l2(a: number[], b: number[]): number {
		let sum = 0
		for (let i = 0; i < a.length; i++) {
			const d = a[i] - b[i]
			sum += d * d
		}
		return Math.sqrt(sum)
	}

	// Search for top-N most similar vectors (lowest L2 distance)
	search(queryEmbedding: number[], topN: number = 5): FaissSearchResult[] {
		if (!this.loaded) throw new Error("FaissClient: Not loaded")
		console.debug(`[FaissClient] Searching for top ${topN} results for domain '${this.domain}'`)
		const scores = this.vectors.map((vec, idx) => ({
			idx,
			score: -this.l2(queryEmbedding, vec), // negative L2 for similarity
		}))
		scores.sort((a, b) => b.score - a.score)
		const output = scores.slice(0, topN).map(({ idx, score }) => ({
			text: this.texts[idx],
			score,
		}))
		console.debug(`[FaissClient] Search output:`, output)
		return output
	}
}

// Helper: Map domain to dummy bundle path
export function getFaissBundlePathForDomain(domain: string): string {
	return `/home/shtlp0015/faiss-test/vectors.json`
}
