const WebScraper = require( "clean-web-scraper" );

const headers = {
	"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
	"Cache-Control": "private",
	"Accept": "application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5",
};

async function runScraper ( config, enable )
{
	const scraper = new WebScraper( config );
	if ( enable )
	{
		await scraper.start();
	}
	return scraper;
}

async function khameneiIrFreePalestineTag ( enable )
{
	const config = {
		baseURL: "https://english.khamenei.ir/news",
		startURL: "https://english.khamenei.ir/page/search.xhtml?topicid=0&period=0&q=FreePalestine&pageSize=100#",
		maxDepth: 10,
		exactExcludeList: [
			"https://english.khamenei.ir/page/search.xhtml?topicid=0&period=0&q=FreePalestine&pageSize=100#",
			"https://english.khamenei.ir/page/search.xhtml?topicid=0&period=0&q=FreePalestine&pageSize=100"
		],
		scrapResultPath: "./dataset/khamenei-ir-free-palestine-tag/website",
		jsonlOutputPath: "./dataset/khamenei-ir-free-palestine-tag/train.jsonl",
		textOutputPath: "./dataset/khamenei-ir-free-palestine-tag/texts",
		csvOutputPath: "./dataset/khamenei-ir-free-palestine-tag/train.csv",
		includeMetadata: true,
		metadataFields: ["author", "articleTitle", "url"],
		axiosRetryDelay: 10000,
		maxArticles: 400
	};
	return await runScraper( config, enable );
}

void async function main ()
{
	const khameneiIrFreePalestineTagScraper = await khameneiIrFreePalestineTag( true );
}();
