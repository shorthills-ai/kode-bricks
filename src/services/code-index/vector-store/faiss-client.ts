// Minimal stub/mock Faiss client for domain-specific vector search
// Replace with real Faiss integration when available

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

	// Simulate loading the bundle (replace with real loader)
	async load(): Promise<void> {
		// Dummy: 10 vectors, each 768-dim, random values
		this.vectors = Array.from({ length: 10 }, () => Array.from({ length: this.dim }, () => Math.random()))
		this.texts = [
			`Manufacturing for ${this.domain}`,
			`Manufacturing site for ${this.domain}`,
			`Manufacturing site useful for ${this.domain}`,
			`Engineering for ${this.domain}`,
			`Engineering site for ${this.domain}`,
			`Engineering site useful for ${this.domain}`,
			`Healthcare for ${this.domain}`,
			`Healthcare site for ${this.domain}`,
			`Healthcare site useful for ${this.domain}`,
		]
		this.loaded = true
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
		const scores = this.vectors.map((vec, idx) => ({
			idx,
			score: -this.l2(queryEmbedding, vec), // negative L2 for similarity
		}))
		scores.sort((a, b) => b.score - a.score)
		return scores.slice(0, topN).map(({ idx, score }) => ({
			text: this.texts[idx],
			score,
		}))
	}
}

// Helper: Map domain to dummy bundle path
export function getFaissBundlePathForDomain(domain: string): string {
	return `/dummy/path/${domain}.faiss.index`
}
