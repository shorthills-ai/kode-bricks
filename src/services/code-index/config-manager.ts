import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderProvider } from "./interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "./interfaces/config"
import { SEARCH_MIN_SCORE } from "./constants"
import { getDefaultModelId, getModelDimension } from "../../shared/embeddingModels"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private isEnabled: boolean = false
	private embedderProvider: EmbedderProvider = "openai"
	private modelId?: string
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private openAiCompatibleOptions?: { baseUrl: string; apiKey: string; modelDimension?: number }
	private vectorStoreType?: "qdrant" | "faiss" | "chroma"
	private vectorStoreUrl?: string
	private vectorStoreApiKey?: string
	private searchMinScore?: number

	constructor(private readonly contextProxy: ContextProxy) {
		// Initialize with current configuration to avoid false restart triggers
		this._loadAndSetConfiguration()
	}

	/**
	 * Private method that handles loading configuration from storage and updating instance variables.
	 * This eliminates code duplication between initializeWithCurrentConfig() and loadConfiguration().
	 */
	private _loadAndSetConfiguration(): void {
		// Load configuration from storage
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: false,
			codebaseIndexVectorStoreType: "qdrant",
			codebaseIndexVectorStoreUrl: "http://localhost:6333",
			codebaseIndexVectorStoreApiKey: "",
			codebaseIndexSearchMinScore: 0.4,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexVectorStoreApiKey,
			codebaseIndexVectorStoreType,
			codebaseIndexVectorStoreUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const vectorStoreApiKey =
			codebaseIndexVectorStoreApiKey ?? this.contextProxy?.getSecret("codebaseIndexVectorStoreApiKey") ?? ""
		const vectorStoreUrl =
			codebaseIndexVectorStoreUrl ?? this.contextProxy?.getGlobalState("codebaseIndexVectorStoreUrl") ?? ""
		const vectorStoreType =
			codebaseIndexVectorStoreType ??
			this.contextProxy?.getGlobalState("codebaseIndexVectorStoreType") ??
			"qdrant"
		const openAiCompatibleBaseUrl = this.contextProxy?.getGlobalState("codebaseIndexOpenAiCompatibleBaseUrl") ?? ""
		const openAiCompatibleApiKey = this.contextProxy?.getSecret("codebaseIndexOpenAiCompatibleApiKey") ?? ""
		const openAiCompatibleModelDimension = this.contextProxy?.getGlobalState(
			"codebaseIndexOpenAiCompatibleModelDimension",
		) as number | undefined

		// Update instance variables with configuration
		this.isEnabled = codebaseIndexEnabled || false
		this.vectorStoreType = vectorStoreType
		this.vectorStoreUrl = vectorStoreUrl
		this.vectorStoreApiKey = vectorStoreApiKey ?? ""
		console.debug(`[CodeIndexConfigManager] Vector store type: ${this.vectorStoreType}`)
		console.debug(`[CodeIndexConfigManager] Vector store URL: ${this.vectorStoreUrl}`)
		console.debug(`[CodeIndexConfigManager] Vector store API key: ${this.vectorStoreApiKey}`)
		this.openAiOptions = { openAiNativeApiKey: openAiKey }
		this.searchMinScore = SEARCH_MIN_SCORE

		// Set embedder provider with support for openai-compatible
		if (codebaseIndexEmbedderProvider === "ollama") {
			this.embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			this.embedderProvider = "openai-compatible"
		} else {
			this.embedderProvider = "openai"
		}

		this.modelId = codebaseIndexEmbedderModelId || undefined

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
		}

		this.openAiCompatibleOptions =
			openAiCompatibleBaseUrl && openAiCompatibleApiKey
				? {
						baseUrl: openAiCompatibleBaseUrl,
						apiKey: openAiCompatibleApiKey,
						modelDimension: openAiCompatibleModelDimension,
					}
				: undefined
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isEnabled: boolean
			isConfigured: boolean
			embedderProvider: EmbedderProvider
			modelId?: string
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
			vectorStoreType?: "qdrant" | "faiss" | "chroma"
			vectorStoreUrl?: string
			vectorStoreApiKey?: string
			searchMinScore?: number
		}
		requiresRestart: boolean
	}> {
		// Capture the ACTUAL previous state before loading new configuration
		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.isEnabled,
			configured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiKey: this.openAiOptions?.openAiNativeApiKey ?? "",
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl ?? "",
			openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
			openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
			openAiCompatibleModelDimension: this.openAiCompatibleOptions?.modelDimension,
			vectorStoreType: this.vectorStoreType ?? "qdrant",
			vectorStoreUrl: this.vectorStoreUrl ?? "http://localhost:6333",
			vectorStoreApiKey: this.vectorStoreApiKey ?? "",
		}

		// Load new configuration from storage and update instance variables
		this._loadAndSetConfiguration()

		const requiresRestart = this.doesConfigChangeRequireRestart(previousConfigSnapshot)

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isEnabled: this.isEnabled,
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				vectorStoreType: this.vectorStoreType,
				vectorStoreUrl: this.vectorStoreUrl,
				vectorStoreApiKey: this.vectorStoreApiKey,
				searchMinScore: this.searchMinScore,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		if (this.embedderProvider === "openai") {
			const openAiKey = this.openAiOptions?.openAiNativeApiKey
			const vectorStoreUrl = this.vectorStoreUrl
			const vectorStoreType = this.vectorStoreType
			const isConfigured = !!(openAiKey && vectorStoreType && vectorStoreUrl)
			return isConfigured
		} else if (this.embedderProvider === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			const ollamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl
			const vectorStoreUrl = this.vectorStoreUrl
			const vectorStoreType = this.vectorStoreType
			const isConfigured = !!(ollamaBaseUrl && vectorStoreType && vectorStoreUrl)
			return isConfigured
		} else if (this.embedderProvider === "openai-compatible") {
			const baseUrl = this.openAiCompatibleOptions?.baseUrl
			const apiKey = this.openAiCompatibleOptions?.apiKey
			const vectorStoreUrl = this.vectorStoreUrl
			const vectorStoreType = this.vectorStoreType
			return !!(baseUrl && apiKey && vectorStoreType && vectorStoreUrl)
		}
		return false // Should not happen if embedderProvider is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 */
	doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured()

		// Handle null/undefined values safely - use empty strings for consistency with loaded config
		const prevEnabled = prev?.enabled ?? false
		const prevConfigured = prev?.configured ?? false
		const prevProvider = prev?.embedderProvider ?? "openai"
		const prevModelId = prev?.modelId ?? undefined
		const prevOpenAiKey = prev?.openAiKey ?? ""
		const prevOllamaBaseUrl = prev?.ollamaBaseUrl ?? ""
		const prevOpenAiCompatibleBaseUrl = prev?.openAiCompatibleBaseUrl ?? ""
		const prevOpenAiCompatibleApiKey = prev?.openAiCompatibleApiKey ?? ""
		const prevOpenAiCompatibleModelDimension = prev?.openAiCompatibleModelDimension
		const prevVectorStoreType = prev?.vectorStoreType ?? "qdrant"
		const prevVectorStoreUrl = prev?.vectorStoreUrl ?? "http://localhost:6333"
		const prevVectorStoreApiKey = prev?.vectorStoreApiKey ?? ""

		// 1. Transition from disabled/unconfigured to enabled+configured
		if ((!prevEnabled || !prevConfigured) && this.isEnabled && nowConfigured) {
			return true
		}

		// 2. If was disabled and still is, no restart needed
		if (!prevEnabled && !this.isEnabled) {
			return false
		}

		// 3. If wasn't ready before and isn't ready now, no restart needed
		if (!prevConfigured && !nowConfigured) {
			return false
		}

		// 4. Check for changes in relevant settings if the feature is enabled (or was enabled)
		if (this.isEnabled || prevEnabled) {
			// Provider change
			if (prevProvider !== this.embedderProvider) {
				return true
			}

			if (this._hasVectorDimensionChanged(prevProvider, prevModelId)) {
				return true
			}

			// Authentication changes
			if (this.embedderProvider === "openai") {
				const currentOpenAiKey = this.openAiOptions?.openAiNativeApiKey ?? ""
				if (prevOpenAiKey !== currentOpenAiKey) {
					return true
				}
			}

			if (this.embedderProvider === "ollama") {
				const currentOllamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl ?? ""
				if (prevOllamaBaseUrl !== currentOllamaBaseUrl) {
					return true
				}
			}

			if (this.embedderProvider === "openai-compatible") {
				const currentOpenAiCompatibleBaseUrl = this.openAiCompatibleOptions?.baseUrl ?? ""
				const currentOpenAiCompatibleApiKey = this.openAiCompatibleOptions?.apiKey ?? ""
				const currentOpenAiCompatibleModelDimension = this.openAiCompatibleOptions?.modelDimension
				if (
					prevOpenAiCompatibleBaseUrl !== currentOpenAiCompatibleBaseUrl ||
					prevOpenAiCompatibleApiKey !== currentOpenAiCompatibleApiKey ||
					prevOpenAiCompatibleModelDimension !== currentOpenAiCompatibleModelDimension
				) {
					return true
				}
			}

			// Qdrant configuration changes
			const currentVectorStoreType = this.vectorStoreType ?? "qdrant"
			const currentVectorStoreUrl = this.vectorStoreUrl ?? "http://localhost:6333"
			const currentVectorStoreApiKey = this.vectorStoreApiKey ?? ""
			if (
				prevVectorStoreUrl !== currentVectorStoreUrl ||
				prevVectorStoreApiKey !== currentVectorStoreApiKey ||
				prevVectorStoreType !== currentVectorStoreType
			) {
				return true
			}
		}

		return false
	}

	/**
	 * Checks if model changes result in vector dimension changes that require restart.
	 */
	private _hasVectorDimensionChanged(prevProvider: EmbedderProvider, prevModelId?: string): boolean {
		const currentProvider = this.embedderProvider
		const currentModelId = this.modelId ?? getDefaultModelId(currentProvider)
		const resolvedPrevModelId = prevModelId ?? getDefaultModelId(prevProvider)

		// If model IDs are the same and provider is the same, no dimension change
		if (prevProvider === currentProvider && resolvedPrevModelId === currentModelId) {
			return false
		}

		// Get vector dimensions for both models
		const prevDimension = getModelDimension(prevProvider, resolvedPrevModelId)
		const currentDimension = getModelDimension(currentProvider, currentModelId)

		// If we can't determine dimensions, be safe and restart
		if (prevDimension === undefined || currentDimension === undefined) {
			return true
		}

		// Only restart if dimensions actually changed
		return prevDimension !== currentDimension
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isEnabled: this.isEnabled,
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			vectorStoreType: this.vectorStoreType,
			vectorStoreUrl: this.vectorStoreUrl,
			vectorStoreApiKey: this.vectorStoreApiKey,
			searchMinScore: this.searchMinScore,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.isEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type (openai or ollama)
	 */
	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	/**
	 * Gets the current Qdrant configuration
	 */

	public get vectorStoreConfig(): {
		type?: "qdrant" | "faiss" | "chroma"
		url?: string
		apiKey?: string
	} {
		return {
			type: this.vectorStoreType,
			url: this.vectorStoreUrl,
			apiKey: this.vectorStoreApiKey,
		}
	}
	/**
	 * Gets the current model ID being used for embeddings.
	 */
	public get currentModelId(): string | undefined {
		return this.modelId
	}

	/**
	 * Gets the configured minimum search score.
	 */
	public get currentSearchMinScore(): number | undefined {
		return this.searchMinScore
	}

	/**
	 * Clears the stored configuration by calling resetAllState on the ContextProxy instance.
	 */
	public async clearConfiguration(): Promise<void> {
		await this.contextProxy.resetAllState()
	}
}
