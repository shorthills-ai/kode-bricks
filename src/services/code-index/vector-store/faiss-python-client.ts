import { spawn } from "child_process"
import * as path from "path"

export type FaissSearchResult = {
	text: string
	score: number
}

export class FaissPythonClient {
	private loaded: boolean = false
	private scriptPath: string
	private bundlePath: string
	private domain: string

	constructor(domain: string, bundlePath: string, scriptPath?: string) {
		this.domain = domain
		this.bundlePath = bundlePath
		// Default to faiss_search.py in the same directory
		this.scriptPath = scriptPath || path.join(__dirname, "faiss_search.py")
	}

	async load(): Promise<void> {
		// For the Python version, we assume the script loads the index on each call, or manages its own cache
		console.debug(
			`[FaissPythonClient] Ready to use Python FAISS script at '${this.scriptPath}' for domain '${this.domain}'`,
		)
		this.loaded = true
	}

	search(queryEmbedding: number[], topN: number = 5): Promise<FaissSearchResult[]> {
		if (!this.loaded) throw new Error("FaissPythonClient: Not loaded")
		return new Promise((resolve, reject) => {
			const args = [
				"--bundle",
				this.bundlePath,
				"--query",
				JSON.stringify(queryEmbedding),
				"--topn",
				String(topN),
			]
			console.debug(`[FaissPythonClient] Spawning Python process: python3 ${this.scriptPath} ${args.join(" ")}`)
			const py = spawn("python3", [this.scriptPath, ...args])
			let stdout = ""
			let stderr = ""
			py.stdout.on("data", (data) => {
				stdout += data.toString()
			})
			py.stderr.on("data", (data) => {
				stderr += data.toString()
			})
			py.on("close", (code) => {
				if (code !== 0) {
					console.debug(`[FaissPythonClient] Python script error: ${stderr}`)
					reject(new Error(`Python script failed with code ${code}: ${stderr}`))
				} else {
					try {
						const results = JSON.parse(stdout)
						console.debug(`[FaissPythonClient] Search results:`, results)
						resolve(results)
					} catch (err) {
						console.debug(`[FaissPythonClient] Failed to parse Python script output: ${stdout}`)
						reject(new Error(`Failed to parse Python script output: ${stdout}`))
					}
				}
			})
		})
	}
}
