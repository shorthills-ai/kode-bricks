import { FaissClient, getFaissBundlePathForDomain, FaissSearchResult } from "./vector-store/faiss-client"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"

// Dummy: Replace with real domain list as needed
export type SupportedDomain = "healthcare" | "manufacturing" | "engineering"

export class DomainVectorRetriever {
	private faissClient: FaissClient | null = null
	private loadedDomain: string | null = null

	constructor(private ollamaEmbedder: CodeIndexOllamaEmbedder) {}

	// Loads the Faiss bundle for the given domain if not already loaded
	async ensureDomainLoaded(domain: SupportedDomain): Promise<void> {
		if (this.loadedDomain === domain && this.faissClient) return
		const bundlePath = getFaissBundlePathForDomain(domain)
		this.faissClient = new FaissClient(domain, bundlePath)
		await this.faissClient.load()
		this.loadedDomain = domain
	}

	// Main entry: Given a user query and domain, return top-N text chunks
	async getTopChunksForQuery(query: string, domain: SupportedDomain, topN: number = 5): Promise<FaissSearchResult[]> {
		await this.ensureDomainLoaded(domain)
		if (!this.faissClient) throw new Error("Faiss client not loaded")

		// Use Ollama to embed the query (returns array of embeddings)
		const embeddingResp = await this.ollamaEmbedder.createEmbeddings([query])
		const embedding = embeddingResp.embeddings[0]
		if (!embedding || embedding.length !== 768) {
			throw new Error("Ollama did not return a 768-dim embedding")
		}

		// Search the Faiss index for top-N similar chunks
		return this.faissClient.search(embedding, topN)
	}
}
