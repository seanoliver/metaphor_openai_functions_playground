import dotenv from 'dotenv';
dotenv.config();
import {
	Configuration,
	OpenAIApi,
	ChatCompletionFunctions,
	ChatCompletionRequestMessage,
} from 'openai-edge';
import { OpenAIStream, StreamingTextResponse, streamToResponse } from 'ai';
import Metaphor from 'metaphor-node';

const metaphor = new Metaphor(process.env.METAPHOR_API_KEY as string);

const config = new Configuration({
	apiKey: process.env['OPENAI_API_KEY'],
});
const openai = new OpenAIApi(config);

async function performWebSearch(query: string) {
	try {
		// Conduct the search
		const searchResponse = await metaphor.search(query);

		// Get the first result
		const firstResult = searchResponse.results[0];

		if (!firstResult) return 'No results found.';

		// Get the content of the first result
		const contentResponse = await metaphor.getContents([firstResult]);

		// Log the content
		return contentResponse.contents[0].extract;
	} catch (err) {
		console.error(`Failed to get content: ${err}`);
	}
}

const messages: ChatCompletionRequestMessage[] = [
	{
		role: 'system',
		content:
			"You are a helpful AI assistant that answers questions from users. If you get asked a question about something that you don't know or that may have changed since your training date, you can search the internet using the provided function to help you answer the question. You can also ask the user to rephrase the question if you don't understand it. Please only use the internet search function if you are unable to answer the question yourself. The internet search function will return the content of a the first search result of the internet search. You must provide it with a query that asks the question the piece of information you want to know about. You can also use the internet search function to find images. You must provide it with a query that asks the question the piece of information you want to know about. You can also use the internet search function to find images. You must provide it with a query that asks the question the piece of information you want to know about, which may not be the same as the question you are answering. Please do not call this function more than 5 times when answering a single question.",
	},
	{
		role: 'user',
		content: 'What is the latest stock price of Apple?',
	},
];

const functions: ChatCompletionFunctions[] = [
	{
		name: 'performWebSearch',
		description:
			'Perform a web search and return the content of the body of the first search result.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: 'The query to search for.',
				},
			},
			required: ['query'],
		},
	},
];

(async () => {
	console.log('Starting');
	async function getResults(
		messages: ChatCompletionRequestMessage[],
		functions: ChatCompletionFunctions[]
	) {
		const response = await openai.createChatCompletion({
			model: 'gpt-4-0613',
			stream: true,
			messages,
		});
		const stream = OpenAIStream(response);

		return stream;
	}
	try {
		const response = await getResults(messages, functions);
		fetchStream(response);
	} catch (err) {
		console.error(err);
	}
})();

async function fetchStream(stream: ReadableStream) {
	const reader = stream.getReader();
	const decoder = new TextDecoder(); // Use the TextDecoder interface to decode bytes to string.
	let accumulator = new Uint8Array(); // This array will accumulate chunks.

	while (true) {
			const { done, value } = await reader.read();
			if (done) {
					// Stream is done. Decode remaining bytes (if any).
					if (accumulator.length > 0) {
							console.log(decoder.decode(accumulator));
					}
					break;
			}

			// Append the new chunk to the accumulator.
			const tmp = new Uint8Array(accumulator.length + value.length);
			tmp.set(accumulator, 0);
			tmp.set(value, accumulator.length);
			accumulator = tmp;

			// Try to decode as much as possible without producing replacement characters.
			let i = accumulator.length;
			while (i > 0 && accumulator[i - 1] > 127) {
					i--;
			}
			console.log(decoder.decode(accumulator.slice(0, i)));
			accumulator = accumulator.slice(i);
	}
	reader.releaseLock();
}
