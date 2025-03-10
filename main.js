const { Ollama } = require( "ollama" )
const { GoogleGenerativeAI } = require( "@google/generative-ai" )
const fs = require( "fs" );
const path = require( "path" )

module.exports = class DeepTruth
{
	constructor ({
		userQuery,
		modelProvider = "ollama",
		ollamaHost = "http://127.0.0.1:11434",
		ollamaOptions = {
			model: "llama3.2", // llama3.2, deepseek-r1:8b
			stream: true,
			options: {
				temperature: 0,
				num_predict: 5500
			}
		},
		geminiOptions = {
			model: "gemini-2.0-flash",
			apiKey: process.env.GOOGLE_API_KEY
		},
		outputDir = "./outputs"
	})
	{
	   this.modelProvider = modelProvider;

		        // Initialize Ollama if selected
		if ( modelProvider === "ollama" )
		{
			this.ollama = new Ollama({ host: ollamaHost })
			this.ollamaOptions = ollamaOptions;
		}

		// Initialize Gemini if selected
		if ( modelProvider === "gemini" )
		{
			this.genAI = new GoogleGenerativeAI( geminiOptions.apiKey );
			this.model = this.genAI.getGenerativeModel({ model: geminiOptions.model });
		}

		this.userQuery = userQuery;
		this.currentOutput = `# ${this.userQuery}\n\n`;
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

	async processArticle ( article )
	{
		try
		{
			const { text, metadata } = article;

			if ( !text || typeof text !== "string" )
			{
				console.warn( `Skipping article with missing or invalid content: ${title || "Untitled"}` );
				return;
			}

			const prompt = this.buildPrompt( metadata, text );

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

	async getModelResponse ( prompt )
	{
		const maxRetries = 3; // Set the maximum number of retries
		let retries = 0;
		let aiResponse = "";

		while ( retries < maxRetries )
		{
			try
			{
				if ( this.modelProvider === "ollama" )
				{
					const response = await this.ollama.generate({
						...this.ollamaOptions,
						prompt
					});

					for await ( const part of response )
					{
						console.log( part.response );
						aiResponse += part.response;
					}
				}
				else if ( this.modelProvider === "gemini" )
				{
					const result = await this.model.generateContentStream( prompt );

					for await ( const chunk of result.stream )
					{
						const chunkText = chunk.text();
						console.log( chunkText );
						aiResponse += chunkText;
					}
				}

				return aiResponse.trim(); // Return the successful response
			}
			catch ( error )
			{
				retries++;
				console.error( `Error getting model response (attempt ${retries}/${maxRetries}):`, error );
				if ( retries < maxRetries )
				{
					console.log( "Retrying in 2 seconds..." );
					await new Promise( resolve => { return setTimeout( resolve, 2000 ) }); // Wait 2 seconds before retrying
				}
				else
				{
					throw error; // Re-throw the error after max retries
				}
			}
		}
	}

	buildPrompt ( metadata, content )
	{
		return `
You are a system designed to find **facts** from the given text and put them into the latest article. Your job is to analyze the provided text and complete the article based on the user query.

**User Query**: 
"${this.userQuery}"

**Text Metadata**:
${Object.entries( metadata ).map( ( [key, value] ) => { return `${key}: ${value || "N/A"}`; }).join( "\n" )}

**Text Content**:
<text>
${content}
</text>

**Current article**:
<article>
${this.currentOutput}
</article>

**Task Instructions**:
- **Only use exact phrases from the text.**.
- **Integrate quotes smoothly** to the current article to form a complete coherent article.
- **Do not add your own words.**.
- Your response must be fully enclosed in:
<output>
the updated article here
</output>
`;
	}

	extractOutputFromResponse ( response )
	{
		let output = response.trim();
		while ( true )
		{
			let matchFound = false;
			const outputRegexes = [
				/<output>([\s\S]*?)<\/output>/,
				/<output>([\s\S]*?)\[\/output\]/,
				/\[output\]([\s\S]*?)\[\/output\]/,
				/<article>([\s\S]*?)<\/article>/,
				/<article>([\s\S]*?)\[\/article\]/,
				/\[article\]([\s\S]*?)\[\/article\]/,
				/<output>\n([\s\S]*?)<\/article>/,
				/<output>\n([\s\S]*?)\[\/article\]/,
			];

			for ( const regex of outputRegexes )
			{
				const match = output.match( regex );
				if ( match && match[1] )
				{
					output = match[1].trim();
					matchFound = true;
					break;
				}
			}

			if ( !matchFound )
			{
				break;
			}
		}
		if ( output === response.trim() )
		{
			console.warn( "Warning: No output or article tags found in response. Using full response." );
		}
		return output;
	}
}
