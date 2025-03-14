const { Ollama } = require( "ollama" );
const { GoogleGenerativeAI } = require( "@google/generative-ai" );
const fs = require( "fs" );
const path = require( "path" );

module.exports = class DeepTruth
{
	constructor ({
		userQuery,
		modelProvider = "ollama",
		ollamaHost = "http://127.0.0.1:11434",
		ollamaOptions = {
			model: "llama3.2", // Options: llama3.2, deepseek-r1:8b
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
		outputDir = "./outputs",
		continueFromArticle = true,
	})
	{
		this.userQuery = userQuery;
		this.modelProvider = modelProvider;
		this.allOutputs = {};
		this.processedArticles = 0;
		this.totalArticles = 0;
		this.outputDir = outputDir;
		this.continueFromArticle = continueFromArticle;

		if ( !userQuery || typeof userQuery !== "string" || userQuery.trim() === "" )
		{
			throw new Error( "A valid user query or topic is required" );
		}

		// Initialize model provider
		if ( modelProvider === "ollama" )
		{
			this.ollama = new Ollama({ host: ollamaHost });
			this.ollamaOptions = ollamaOptions;
		}
		else if ( modelProvider === "gemini" )
		{
			this.genAI = new GoogleGenerativeAI( geminiOptions.apiKey );
			this.model = this.genAI.getGenerativeModel({ model: geminiOptions.model });
		}

		// Setup output directory
		this.createOutputDirectory();
	}

	async processArticles ( articles )
	{
		try
		{
			if ( !Array.isArray( articles ) || articles.length === 0 )
			{
				throw new Error( "Input must be a non-empty array of article objects" );
			}

			let startIndex = this.countSavedArticles();
			this.totalArticles = articles.length;
			this.processedArticles = startIndex;

			console.log( `Continuing Deep Truth analysis from article ${
				startIndex + 1
			} of ${this.totalArticles} for query: "${this.userQuery}"...` );

			for ( let i = startIndex; i < articles.length; i++ )
			{
				const article = articles[i];
				const { prompt, response } = await this.processSingleArticle( article );

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
				this.processedArticles++;
				console.log( `Processed ${this.processedArticles}/${this.totalArticles} articles` );
			}

			console.log( "Deep Truth analysis complete!" );
			this.generateCurrentJson();
			return this.allOutputs;
		}
		catch ( error )
		{
			console.error( "Error in Deep Truth analysis:", error );
			this.generateCurrentJson();
			throw error;
		}
	}

	async processSingleArticle ( article )
	{
		const { text, metadata } = article;

		if ( !text || typeof text !== "string" )
		{
			console.warn( `Skipping article with missing or invalid content: ${metadata.articleTitle || "Untitled"}` );
			return;
		}

		const prompt = this.buildPrompt( metadata, text );
		const response = await this.getModelResponse( prompt );
		console.log( "response:", response );
		const extractedOutput = this.extractOutputFromResponse( response );
		return { prompt, response: extractedOutput };
	}

	buildPrompt ( metadata, content )
	{
		return `
You are a system designed to extract related paragraphs from the provided text based on the user query.

**User Query**: 
"${this.userQuery}"

**Text Metadata**:
${Object.entries( metadata )
	.map( ( [key, value] ) => { return `${key}: ${value || "N/A"}` })
	.join( "\n" )}

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
  }
]
\`\`\`
`;
	}

	async getModelResponse ( prompt )
	{
		const maxRetries = 3; // Maximum number of retries
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
						prompt,
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
				return aiResponse.trim();
			}
			catch ( error )
			{
				retries++;
				console.error( `Error getting model response (attempt ${retries}/${maxRetries}):`, error );
				if ( retries < maxRetries )
				{
					console.log( "Retrying in 2 seconds..." );
					await new Promise( ( resolve ) => { return setTimeout( resolve, 5000 ) });
				}
				else
				{
					throw error;
				}
			}
		}
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

	generateCurrentJson ()
	{
		this.allOutputs = {};
		const files = fs
		.readdirSync( this.outputDir )
		.filter( ( file ) => { return file.endsWith( ".json" ) && file !== "current.json" })
		.sort( ( a, b ) =>
		{
			const numA = parseInt( a.split( "." )[0] );
			const numB = parseInt( b.split( "." )[0] );
			return numA - numB;
		});

		for ( let i = 0; i < files.length; i++ )
		{
			const outputFilePath = path.join( this.outputDir, files[i] );
			if ( fs.existsSync( outputFilePath ) )
			{
				const outputData = JSON.parse( fs.readFileSync( outputFilePath, "utf8" ) );
				if ( outputData.response && outputData.response.length > 0 )
				{
					const fileIndex = parseInt( files[i].split( "." )[0] );
					this.allOutputs[fileIndex] = {
						response: outputData.response,
						url: outputData.processedArticle.url,
					};
				}
			}
		}
		fs.writeFileSync( path.join( this.outputDir, "current.json" ), JSON.stringify( this.allOutputs, null, 2 ) );
	}

	countSavedArticles ()
	{
		let count = 0;
		if ( fs.existsSync( this.outputDir ) )
		{
			const files = fs.readdirSync( this.outputDir );
			for ( const file of files )
			{
				if ( file.endsWith( ".json" ) && file !== "current.json" )
				{
					count++;
				}
			}
		}
		return count;
	}

	createOutputDirectory ()
	{
		if ( this.continueFromArticle === false )
		{
			if ( fs.existsSync( this.outputDir ) )
			{
				fs.rmSync( this.outputDir, { recursive: true });
			}
			fs.mkdirSync( this.outputDir, { recursive: true });
		}
		else
		{
			if ( !fs.existsSync( this.outputDir ) )
			{
				fs.mkdirSync( this.outputDir, { recursive: true });
			}
		}
	}
};
