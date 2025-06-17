import { FaissClient, FaissSearchResult } from "./vector-store/faiss-client"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"

// Dummy: Replace with real domain list as needed
export type SupportedDomain = "healthcare" | "manufacturing" | "engineering"

export class DomainVectorRetriever {
	private faissClient: FaissClient | null = null
	private loadedDomain: string | null = null

	constructor(private ollamaEmbedder: CodeIndexOllamaEmbedder) {}

	// Loads the Faiss bundle for the given domain if not already loaded
	async ensureDomainLoaded(domain: SupportedDomain): Promise<void> {
		console.debug(`[DomainVectorRetriever] ensureDomainLoaded called for domain: ${domain}`)
		if (this.loadedDomain === domain && this.faissClient) {
			console.debug(`[DomainVectorRetriever] Domain '${domain}' already loaded.`)
			return
		}
		// Use a static path for POC
		const staticBundlePath = "/home/shtlp0015/faiss-test/vectors.json"
		console.debug(
			`[DomainVectorRetriever] Loading FaissClient for domain '${domain}' with bundle '${staticBundlePath}'`,
		)
		this.faissClient = new FaissClient(domain, staticBundlePath)
		await this.faissClient.load()
		this.loadedDomain = domain
		console.debug(`[DomainVectorRetriever] FaissClient loaded for domain '${domain}'`)
	}

	// Main entry: Given a user query and domain, return top-N text chunks
	async getTopChunksForQuery(query: string, domain: SupportedDomain, topN: number = 5): Promise<FaissSearchResult[]> {
		console.debug(`[DomainVectorRetriever] getTopChunksForQuery called for domain: ${domain}, query: ${query}`)
		await this.ensureDomainLoaded(domain)
		if (!this.faissClient) throw new Error("Faiss client not loaded")

		// Use Ollama to embed the query (returns array of embeddings)
		console.debug(`[DomainVectorRetriever] Generating embedding for query: ${query}`)
		const embeddingResp = await this.ollamaEmbedder.createEmbeddings([query])
		const embedding = embeddingResp.embeddings[0]
		if (!embedding || embedding.length !== 768) {
			console.debug(`[DomainVectorRetriever] Invalid embedding returned from Ollama`)
			throw new Error("Ollama did not return a 768-dim embedding")
		}

		console.debug(`[DomainVectorRetriever] Embedding generated, searching Faiss index...`)
		// Search the Faiss index for top-N similar chunks
		const results = this.faissClient.search(embedding, topN)
		console.debug(`[DomainVectorRetriever] Search results:`, results)
		return results
	}
}
