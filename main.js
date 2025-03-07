const { Ollama } = require( "ollama" )
const fs = require( "fs" );
const path = require( "path" )

module.exports = class DeepTruth
{
	constructor ({
		userQuery,
		ollamaHost = "http://127.0.0.1:11434",
		ollamaOptions = {
			model: "llama3.2", // llama3.2, deepseek-r1:8b
			stream: true,
			options: {
				temperature: 0,
				num_predict: 5500
			}
		},
		outputDir = "./outputs"
	})
	{
		this.ollama = new Ollama({ host: ollamaHost })
		this.ollamaOptions = ollamaOptions;
		this.userQuery = userQuery;
		this.currentOutput = "";
		this.processedArticles = 0;
		this.totalArticles = 0;
		this.outputDir = outputDir; // Store output directory

		if ( !userQuery || typeof userQuery !== "string" || userQuery.trim() === "" )
		{
			throw new Error( "A valid user query or topic is required" );
		}

		if ( fs.existsSync( this.outputDir ) )
		{
			fs.rmSync( this.outputDir, { recursive: true });
		}
		fs.mkdirSync( this.outputDir, { recursive: true });
	}

	/**
	* Process an array of article objects to extract meaningful insights
	* @param {Array} articles - Array of article objects
	* @returns {Promise<string>} The synthesized output
	*/
	async processArticles ( articles )
	{
		try
		{
			if ( !Array.isArray( articles ) || articles.length === 0 )
			{
				throw new Error( "Input must be a non-empty array of article objects" );
			}

			this.totalArticles = articles.length;
			this.processedArticles = 0;
			const processedUrls = [];

			console.log( `Starting Deep Truth analysis on ${this.totalArticles} articles for query: "${this.userQuery}"...` );

			for ( const article of articles )
			{
				const { prompt, response } = await this.processArticle( article );
				this.processedArticles++;
				processedUrls.push( article.metadata.url ); // Add the URL of the processed article
				const outputFilePath = path.join( this.outputDir, `${this.processedArticles}.json` );
				const outputData = {
					userQuery: this.userQuery,
					currentOutput: this.currentOutput,
					lastProcessedArticle: {
						text: article.text,
						title: article.metadata.articleTitle,
						url: article.metadata.url
					},
					prompt,
					response,
					processedUrls
				};
				fs.writeFileSync( outputFilePath, JSON.stringify( outputData, null, 2 ) );

				console.log( `Processed ${this.processedArticles}/${this.totalArticles} articles` );
			}

			console.log( "Deep Truth analysis complete!" );
			return this.currentOutput;
		}
		catch ( error )
		{
			console.error( "Error in Deep Truth analysis:", error );
			throw error;
		}
	}

	/**
	* Process a single article and update the current synthesis
	* @param {Object} article - The article object
	*/
	async processArticle ( article )
	{
		try
		{
			const { text: content, metadata } = article;

			if ( !content || typeof content !== "string" )
			{
				console.warn( `Skipping article with missing or invalid content: ${title || "Untitled"}` );
				return;
			}

			const prompt = `
You are Deep Truth, a system designed to find and present **verifiable facts** using **only exact quotes** from the given text. Your job is to analyze the provided text and update the synthesis based on the user query.

### **User Query**: 
"${this.userQuery}"

### **Text Metadata**:
${Object.entries( metadata ).map( ( [key, value] ) => { return `${key}: ${value || "N/A"}` }).join( "\n" )}

### **Text Content**:
[text begin]
${content}
[text end]

### **Current Synthesis**:
[synthesis begin]
${this.currentOutput}
[synthesis end]

### **Task Instructions**:
- **Only use exact phrases from the text.** Do not paraphrase or add information that is not in the text.
- **Integrate quotes smoothly** to form a coherent article.
- **Cite sources** using numbered references like [1], [2] corresponding to the article URLs.
- **Do not add your own words.** Just structure the found truths clearly.
- If **no relevant information** is found, return exactly: <output>No relevant information found.</output>
- Your response must be fully enclosed in:
<output>
{your updated synthesis here}
</output>
`;

			const response = await this.getModelResponse( prompt );
			const extractedOutput = this.extractOutputFromResponse( response );
			if ( !extractedOutput.toLowerCase().trim().includes( "no relevant information found" ) )
			{
				this.currentOutput = extractedOutput;
			}
			return { prompt, response }
		}
		catch ( error )
		{
			console.error( `Error processing article: ${error.message}` );
		}
	}

	extractOutputFromResponse ( response )
	{
		const outputRegexes = [
			/<output>([\s\S]*?)<\/output>/,
			/<output>([\s\S]*?)\[\/output\]/,
			/\[output\]([\s\S]*?)\[\/output\]/
		];

		for ( const regex of outputRegexes )
		{
			const match = response.match( regex );
			if ( match && match[1] )
			{
				return match[1].trim();
			}
		}

		console.warn( "Warning: No output tags found in response. Using full response." );
		return response.trim();
	}

	async getModelResponse ( prompt )
	{
		try
		{
			const response = await this.ollama.generate({
				...this.ollamaOptions,
				prompt
			});

			let aiResponse = "";
			for await ( const part of response )
			{
				console.log( part.response );
				aiResponse += part.response;
			}

			return aiResponse.trim();
		}
		catch ( error )
		{
			console.error( "Error getting model response:", error );
			throw error;
		}
	}
}
