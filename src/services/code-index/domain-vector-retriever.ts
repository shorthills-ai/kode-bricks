// This is the vector retriever for the domain. It uses the Faiss server to retrieve the top N text chunks for a given query.

import { domains } from "../../shared/domains"
import nodeFetch from "node-fetch"

async function createAzureEmbedding(texts: string[]): Promise<number[][]> {
	const endpoint = process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT || ""
	const apiKey = process.env.AZURE_OPENAI_KEY || ""
	if (!apiKey) throw new Error("AZURE_OPENAI_KEY is not set in environment")
	const response = await nodeFetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": apiKey,
		},
		body: JSON.stringify({ input: texts }),
	})
	if (!response.ok) {
		const errText = await response.text()
		throw new Error(`Azure OpenAI embedding error: ${errText}`)
	}
	const data = (await response.json()) as any
	return data.data.map((item: any) => item.embedding)
}

export class DomainVectorRetriever {
	private loadedDomain: string | null = null

	constructor(private domain: string) {}

	// Loads the Faiss bundle for the given domain if not already loaded (now just checks domain)
	async ensureDomainLoaded(): Promise<void> {
		const domain = this.domain
		console.debug(`[DomainVectorRetriever] ensureDomainLoaded called for domain: ${domain}`)
		const availableDomains = domains.map((d) => d.slug)
		if (!availableDomains.includes(domain)) {
			console.debug(`[DomainVectorRetriever] Invalid domain: ${domain}`)
			throw new Error(`Domain '${domain}' is not supported`)
		}
		if (this.loadedDomain === domain) {
			console.debug(`[DomainVectorRetriever] Domain '${domain}' already loaded.`)
			return
		}
		this.loadedDomain = domain
	}

	// Main entry: Given a user query, return top-N text chunks
	async getTopChunksForQuery(query: string, topN: number = 5): Promise<any[]> {
		const domain = this.domain
		console.debug(`[DomainVectorRetriever] getTopChunksForQuery called for domain: ${domain}, query: ${query}`)
		await this.ensureDomainLoaded()

		console.debug(`[DomainVectorRetriever] Generating embedding for query: ${query}`)
		const embeddings = await createAzureEmbedding([query])
		const embedding = embeddings[0]
		if (!embedding || embedding.length !== 1536) {
			console.debug(`[DomainVectorRetriever] Invalid embedding returned from Azure OpenAI`)
			throw new Error("Azure OpenAI did not return a 1536-dim embedding")
		}

		console.debug(`[DomainVectorRetriever] Querying Python FAISS server...`)
		const response = await nodeFetch("http://localhost:8000/search", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ domain, embedding, top_n: topN }),
		})
		if (!response.ok) {
			const errText = await response.text()
			console.debug(`[DomainVectorRetriever] Python server error: ${errText}`)
			throw new Error(`Python FAISS server error: ${errText}`)
		}
		const data = (await response.json()) as any
		console.debug(`[DomainVectorRetriever] Search results:`, data.results)
		return data.results
	}
}
