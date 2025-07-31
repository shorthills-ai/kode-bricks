import axios from "axios"
import { IVectorStore, PointStruct, VectorStoreSearchResult, Payload } from "../interfaces/vector-store"

// TODO: Fill in endpoint details as per actual Faiss server API

export class FaissVectorStore implements IVectorStore {
  private readonly FAISS_URL: string
  private readonly vectorSize: number
  private readonly collectionName: string

  constructor(workspacePath: string, url: string, vectorSize: number) {
    this.FAISS_URL = url || "http://localhost:8000"
    this.vectorSize = vectorSize
    // Use a simple hash or workspacePath as collection name
    this.collectionName = encodeURIComponent(workspacePath)
    console.log(`[FaissVectorStore] Collection name: ${this.collectionName}`)
  }

  public async initialize(): Promise<boolean> {
    // TODO: Implement collection creation if needed
    console.debug("[FaissVectorStore] Initializing Faiss collection...")
    // For many Faiss setups, this may be a no-op
    return true
  }

  public async upsertPoints(points: PointStruct[]): Promise<void> {
    try {
      console.debug(`[FaissVectorStore] Upserting ${points.length} points`)
      await axios.post(`${this.FAISS_URL}/collections/${this.collectionName}/upsert`, {
        points,
        vectorSize: this.vectorSize,
      })
    } catch (error) {
      console.error("[FaissVectorStore] Failed to upsert points:", error)
      throw error
    }
  }

  public async search(queryVector: number[], directoryPrefix?: string, minScore?: number): Promise<VectorStoreSearchResult[]> {
    try {
      const params: any = {
        queryVector,
        limit: 10,
        minScore,
        directoryPrefix,
      }
      const response = await axios.post(`${this.FAISS_URL}/collections/${this.collectionName}/search`, params)
      // Expecting response.data to be an array of VectorStoreSearchResult
      return response.data as VectorStoreSearchResult[]
    } catch (error) {
      console.error("[FaissVectorStore] Failed to search points:", error)
      throw error
    }
  }

  public async deletePointsByFilePath(filePath: string): Promise<void> {
    return this.deletePointsByMultipleFilePaths([filePath])
  }

  public async deletePointsByMultipleFilePaths(filePaths: string[]): Promise<void> {
    try {
      await axios.post(`${this.FAISS_URL}/collections/${this.collectionName}/delete`, {
        filePaths,
      })
    } catch (error) {
      console.error("[FaissVectorStore] Failed to delete points by file paths:", error)
      throw error
    }
  }

  public async clearCollection(): Promise<void> {
    try {
      await axios.post(`${this.FAISS_URL}/collections/${this.collectionName}/clear`)
    } catch (error) {
      console.error("[FaissVectorStore] Failed to clear collection:", error)
      throw error
    }
  }

  public async deleteCollection(): Promise<void> {
    try {
      await axios.delete(`${this.FAISS_URL}/collections/${this.collectionName}`)
    } catch (error) {
      console.error(`[FaissVectorStore] Failed to delete collection ${this.collectionName}:`, error)
      throw error
    }
  }

  public async collectionExists(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.FAISS_URL}/collections/${this.collectionName}`)
      return response.status === 200
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return false
      }
      console.error("[FaissVectorStore] Failed to check collection existence:", error)
      throw error
    }
  }
} 