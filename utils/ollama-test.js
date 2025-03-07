const { Ollama } = require( "ollama" )


void async function main ()
{
	const ollama = new Ollama({ host: "http://127.0.0.1:11434" })
	const message = { role: "user", content: "deepseek-r1:8b" }
	const response = await ollama.chat({ model: "llama3.1:8b", messages: [message], stream: true })
	for await ( const part of response )
	{
		process.stdout.write( part.message.content )
	}
}()