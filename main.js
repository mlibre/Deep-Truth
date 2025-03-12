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
		this.allOutputs = {};
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

			console.log( `Starting Deep Truth analysis on ${this.totalArticles} articles for query: "${this.userQuery}"...` );

			for ( const article of articles )
			{
				const { prompt, response } = await this.processArticle( article );
				this.allOutputs[this.processedArticles] = { response, url: article.metadata.url };
				this.processedArticles++;
				const outputFilePath = path.join( this.outputDir, `${this.processedArticles}.json` );
				const outputData = {
					userQuery: this.userQuery,
					response,
					processedArticle: {
						text: article.text,
						title: article.metadata.articleTitle,
						url: article.metadata.url
					},
					prompt
				};
				fs.writeFileSync( outputFilePath, JSON.stringify( outputData, null, 2 ) );
				fs.writeFileSync( path.join( this.outputDir, "current.json" ), JSON.stringify( this.allOutputs, null, 2 ) );
				console.log( `Processed ${this.processedArticles}/${this.totalArticles} articles` );
			}

			console.log( "Deep Truth analysis complete!" );
			return this.allOutputs;
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
			console.log( "response:", response );
			const extractedOutput = this.extractOutputFromResponse( response );
			return { prompt, response: extractedOutput }
		}
		catch ( error )
		{
			console.error( `Error processing article: ${error.message}` );
		}
	}

	buildPrompt ( metadata, content )
	{
		return `
You are a system designed to extract related paragraphs from the provided text based on the user query.

**User Query**: 
"${this.userQuery}"

**Text Metadata**:
${Object.entries( metadata ).map( ( [key, value] ) => { return `${key}: ${value || "N/A"}`; }).join( "\n" )}

**Text Content**:
<text>
${content}
</text>


**Task Instructions**:
- **Extract relevant paragraphs** from the text that are related to the user query.
- **Format your response as a JSON array** inside (\`\`\`json , \`\`\`). Each paragraph should be an object with a "paragraph" key.
\`\`\`json
[
  {
    "paragraph": "extracted paragraph 1"
  },
  {
    "paragraph": "extracted paragraph 2"
  },
  // ...
]
\`\`\`
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
				/```output\n([\s\S]*?)```/,
				/```json\n([\s\S]*?)```/
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
		return JSON.parse( output );
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
					await new Promise( resolve => { return setTimeout( resolve, 5000 ) });
				}
				else
				{
					throw error;
				}
			}
		}
	}
}
