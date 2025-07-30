import type { Anthropic } from "@anthropic-ai/sdk"
import {
	GoogleGenAI,
	type GenerateContentResponseUsageMetadata,
	type GenerateContentParameters,
	type GenerateContentConfig,
} from "@google/genai"
import type { JWTInput } from "google-auth-library"

import { type ModelInfo, type GeminiModelId, geminiDefaultModelId, geminiModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { safeJsonParse } from "../../shared/safeJsonParse"

import { convertAnthropicContentToGemini, convertAnthropicMessageToGemini } from "../transform/gemini-format"
import type { ApiStream } from "../transform/stream"
import { getModelParams } from "../transform/model-params"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { BaseProvider } from "./base-provider"

type GeminiHandlerOptions = ApiHandlerOptions & {
	isVertex?: boolean
	enableCaching?: boolean
	cacheTTL?: string
}

export class GeminiHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: GeminiHandlerOptions

	private client: GoogleGenAI
	private cacheName?: string
	private sessionId?: string

	constructor({ isVertex, ...options }: GeminiHandlerOptions) {
		super()

		this.options = options

		const project = this.options.vertexProjectId ?? "not-provided"
		const location = this.options.vertexRegion ?? "not-provided"
		const apiKey = this.options.geminiApiKey ?? "not-provided"

		this.client = this.options.vertexJsonCredentials
			? new GoogleGenAI({
					vertexai: true,
					project,
					location,
					googleAuthOptions: {
						credentials: safeJsonParse<JWTInput>(this.options.vertexJsonCredentials, undefined),
					},
				})
			: this.options.vertexKeyFile
				? new GoogleGenAI({
						vertexai: true,
						project,
						location,
						googleAuthOptions: { keyFile: this.options.vertexKeyFile },
					})
				: isVertex
					? new GoogleGenAI({ vertexai: true, project, location })
					: new GoogleGenAI({ apiKey })
	}

	// Call this method at the start of a new session to reset cache
	startSession(sessionId: string) {
		this.sessionId = sessionId
		this.cacheName = undefined
		console.log(`[GeminiHandler] startSession called for sessionId: ${sessionId}, cache reset`)
	}

	// Optionally clear cache/session data on session end
	endSession() {
		console.log(`[GeminiHandler] endSession called for sessionId: ${this.sessionId}`)
		this.cacheName = undefined
		this.sessionId = undefined
	}

	async *createMessage(
		systemInstruction: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: model, info, reasoning: thinkingConfig, maxTokens } = this.getModel()
		const contents = messages.map(convertAnthropicMessageToGemini)

		console.log("[GeminiHandler] createMessage - model:", model)
		console.log("[GeminiHandler] createMessage - thinkingConfig:", thinkingConfig)
		console.log("[GeminiHandler] createMessage - maxTokens:", maxTokens)
		console.log("[GeminiHandler] createMessage - enableCaching:", this.options.enableCaching)
		console.log("[GeminiHandler] createMessage - cacheTTL:", this.options.cacheTTL)
		console.log("[GeminiHandler] createMessage - cacheName (before):", this.cacheName)
		console.log("[GeminiHandler] createMessage - sessionId:", this.sessionId)

		let config: GenerateContentConfig = {
			httpOptions: this.options.googleGeminiBaseUrl ? { baseUrl: this.options.googleGeminiBaseUrl } : undefined,
			maxOutputTokens: this.options.modelMaxTokens ?? maxTokens ?? undefined,
			temperature: this.options.modelTemperature ?? 0,
		}

		if (this.options.enableCaching && !this.cacheName) {
			console.log("[GeminiHandler] createMessage - Creating cache for session:", this.sessionId)
			const cache = await this.client.caches.create({
				model,
				config: {
					systemInstruction,
					ttl: this.options.cacheTTL ?? "3600s",
				},
			})
			this.cacheName = cache.name
			console.log("[GeminiHandler] createMessage - Cache created with name:", this.cacheName)
		}

		if (!this.options.enableCaching) {
			// Only set systemInstruction/thinkingConfig if not using cache
			config = {
				...config,
				systemInstruction,
				thinkingConfig,
			}
		}

		const params: GenerateContentParameters = {
			model,
			contents,
			config: this.options.enableCaching ? { ...config, cachedContent: this.cacheName } : config,
		}
		console.log("[GeminiHandler] createMessage - Using cache with name:", this.cacheName)

		const result = await this.client.models.generateContentStream(params)

		let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined

		for await (const chunk of result) {
			if (chunk.candidates && chunk.candidates.length > 0) {
				const candidate = chunk.candidates[0]
				if (candidate.content && candidate.content.parts) {
					for (const part of candidate.content.parts) {
						if (part.thought) {
							if (part.text) {
								yield { type: "reasoning", text: part.text }
							}
						} else {
							if (part.text) {
								yield { type: "text", text: part.text }
							}
						}
					}
				}
			} else if (chunk.text) {
				yield { type: "text", text: chunk.text }
			}

			if (chunk.usageMetadata) {
				lastUsageMetadata = chunk.usageMetadata
			}
		}

		if (lastUsageMetadata) {
			const inputTokens = lastUsageMetadata.promptTokenCount ?? 0
			const outputTokens = lastUsageMetadata.candidatesTokenCount ?? 0
			const cacheReadTokens = lastUsageMetadata.cachedContentTokenCount
			const reasoningTokens = lastUsageMetadata.thoughtsTokenCount

			const totalCost = this.calculateCost({ info, inputTokens, outputTokens, cacheReadTokens })
			console.log("[GeminiHandler] createMessage - usageMetadata:", JSON.stringify(lastUsageMetadata, null, 2))
			console.log("[GeminiHandler] createMessage - cost calculation:", {
				inputTokens,
				outputTokens,
				cacheReadTokens,
				totalCost,
			})

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
				cacheReadTokens,
				reasoningTokens,
				totalCost,
			}
		}
	}

	override getModel() {
		const modelId = this.options.apiModelId
		let id = modelId && modelId in geminiModels ? (modelId as GeminiModelId) : geminiDefaultModelId
		const info: ModelInfo = geminiModels[id]
		const params = getModelParams({ format: "gemini", modelId: id, model: info, settings: this.options })

		return { id: id.endsWith(":thinking") ? id.replace(":thinking", "") : id, info, ...params }
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			const { id: model } = this.getModel()

			const result = await this.client.models.generateContent({
				model,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					httpOptions: this.options.googleGeminiBaseUrl
						? { baseUrl: this.options.googleGeminiBaseUrl }
						: undefined,
					temperature: this.options.modelTemperature ?? 0,
				},
			})

			return result.text ?? ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini completion error: ${error.message}`)
			}

			throw error
		}
	}

	override async countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
		try {
			const { id: model } = this.getModel()

			const response = await this.client.models.countTokens({
				model,
				contents: convertAnthropicContentToGemini(content),
			})

			if (response.totalTokens === undefined) {
				console.warn("Gemini token counting returned undefined, using fallback")
				return super.countTokens(content)
			}

			return response.totalTokens
		} catch (error) {
			console.warn("Gemini token counting failed, using fallback", error)
			return super.countTokens(content)
		}
	}

	public calculateCost({
		info,
		inputTokens,
		outputTokens,
		cacheReadTokens = 0,
	}: {
		info: ModelInfo
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
	}) {
		if (!info.inputPrice || !info.outputPrice || !info.cacheReadsPrice) {
			console.log("[GeminiHandler] calculateCost - missing price info", { info })
			return undefined
		}

		let inputPrice = info.inputPrice
		let outputPrice = info.outputPrice
		let cacheReadsPrice = info.cacheReadsPrice

		if (info.tiers) {
			const tier = info.tiers.find((tier) => inputTokens <= tier.contextWindow)

			if (tier) {
				inputPrice = tier.inputPrice ?? inputPrice
				outputPrice = tier.outputPrice ?? outputPrice
				cacheReadsPrice = tier.cacheReadsPrice ?? cacheReadsPrice
			}
		}

		const uncachedInputTokens = inputTokens - cacheReadTokens

		let cacheReadCost = cacheReadTokens > 0 ? cacheReadsPrice * (cacheReadTokens / 1_000_000) : 0

		const inputTokensCost = inputPrice * (uncachedInputTokens / 1_000_000)
		const outputTokensCost = outputPrice * (outputTokens / 1_000_000)
		const totalCost = inputTokensCost + outputTokensCost + cacheReadCost

		const trace: Record<string, { price: number; tokens: number; cost: number }> = {
			input: { price: inputPrice, tokens: uncachedInputTokens, cost: inputTokensCost },
			output: { price: outputPrice, tokens: outputTokens, cost: outputTokensCost },
		}

		if (cacheReadTokens > 0) {
			trace.cacheRead = { price: cacheReadsPrice, tokens: cacheReadTokens, cost: cacheReadCost }
		}

		console.log("[GeminiHandler] calculateCost - trace:", trace)
		console.log("[GeminiHandler] calculateCost - totalCost:", totalCost)

		return totalCost
	}
}
