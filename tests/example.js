const fs = require( "fs" );
const DeepTruth = require( "../main" );
const dotenv = require( "dotenv" );
dotenv.config();

const data = fs.readFileSync( "./dataset/khamenei-ir-free-palestine-tag/train_with_metadata.jsonl", "utf8" );
const khameneiIr = data
.split( "\n" )
.filter( line => { return line.trim().length > 0 })
.map( line => { return JSON.parse( line ) });

void async function main ()
{
	const userQuery = "What is Imam khameneyi openion about US?";

	const articles = [
		{
			text: "US definitely an accomplice in the crimes committed in Gaza\n\nImam Khamenei\nOct. 25, 2023\n\nClick on the image to view the large size",
			metadata:
			{
				articleTitle: "US definitely an accomplice in the crimes committed in Gaza",
				url: "https://english.khamenei.ir/news/10212/US-definitely-an-accomplice-in-the-crimes-committed-in-Gaza"
			}
		},
		{ "text": "The future world belongs to Palestine\nIt does not belong to the usurping Zionist regime. The future belongs to the Palestinians.\n\nImam Khamenei\nOct. 25, 2023\n\nClick on the image to view the large size", "metadata": { "articleTitle": "The future world belongs to Palestine", "url": "https://english.khamenei.ir/news/10231/The-future-world-belongs-to-Palestine" } },
		{ "text": "But there are two important points alongside this oppression. One is the patience of these people and the people’s trust in God. These people have truly been patient. In addition to this, another important point is that the blow that has been inflicted in this event, in the attack by the Palestinian fighters on the usurping regime, was a decisive blow.\n\nImam Khamenei\nOct. 25, 2023\n\nClick on the image to view the large size", "metadata": { "articleTitle": "Oppressed but Powerful", "url": "https://english.khamenei.ir/news/10222/Oppressed-but-Powerful" } }
	];

	const deepTruth = new DeepTruth({
		userQuery,
		outputDir: "./outputs",
		modelProvider: "gemini",
		geminiOptions: {
			model: "gemini-2.0-flash",
			apiKey: process.env.GOOGLE_API_KEY
		}
	});
	const result = await deepTruth.processArticles( khameneiIr );

	console.log( "\nFINAL SYNTHESIS:" );
	console.log( result );
}()