# Deep Truth

Welcome to **Deep Truth** – an AI-powered fact-finder and article enhancer! 🎉  
DeepTruth is a super cool Node.js project that processes articles using state-of-the-art generative AI models like [Ollama](https://ollama.com) to extract exact quotes and integrate them into a cohesive article. If you love blending tech and storytelling, you’re in the right place!

---

## Table of Contents

* [Table of Contents](#table-of-contents)
* [What Is DeepTruth?](#what-is-deeptruth)
* [Features](#features)
* [Installation](#installation)
* [Set up your environment variables (Optional)](#set-up-your-environment-variables-optional)
* [Usage](#usage)
* [Configuration Options](#configuration-options)
* [How It Works](#how-it-works)
* [Standing with Palestine 🇵🇸](#standing-with-palestine-)

---

## What Is DeepTruth?

DeepTruth is designed to:

* **Analyze** a collection of articles based on a user-defined query.
* **Extract** exact phrases and facts from text.
* **Integrate** these quotes into a growing, coherent article.
* **Support** multiple AI model providers with easy configuration.

Think of it as your personal truth detective—digging deep into articles and assembling the ultimate narrative! 🕵️‍♂️✨

---

## Features

* **Multi-Model Support:** Choose between Ollama and Google Generative AI.
* **Streaming Responses:** Processes AI responses in real-time.
* **Customizable Output:** Saves outputs in JSON format to your specified directory.
* **Easy-to-Use API:** Designed as a class to integrate seamlessly into your projects.

---

## Installation

```bash
git clone https://github.com/mlibre/deeptruth.git
cd deeptruth
npm install
```

## Set up your environment variables (Optional)

If you plan to use Gemini (Google Generative AI), make sure to add your API key:

```bash
export GOOGLE_API_KEY=your_google_api_key_here
```

---

## Usage

Here's a quick example to get you started:

```js
const DeepTruth = require('./DeepTruth');

(async () => {
 const deepTruth = new DeepTruth({
 userQuery: "What's the truth behind today's headlines?",
 modelProvider: "ollama", // or "gemini"
 ollamaHost: "http://127.0.0.1:11434",
 ollamaOptions: {
  model: "llama3.2",
  stream: true,
  options: { temperature: 0, num_predict: 5500 }
 },
 geminiOptions: {
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_API_KEY
 },
 outputDir: "./outputs"
 });

 // Assume you have an array of article objects ready to process
 const articles = [
 {
  text: "Article text goes here...",
  metadata: {
   articleTitle: "Breaking News: AI Revolution",
   url: "https://example.com/ai-revolution"
  }
 },
 // more articles...
 ];
 await deepTruth.processArticles(articles);
})();
```

Run your script with:

```bash
node your-script.js
```

---

## Configuration Options

When initializing DeepTruth, you can customize:

* **`userQuery`** (string): The query/topic for analysis (required).
* **`modelProvider`** (string): Choose `"ollama"` or `"gemini"`. Default is `"ollama"`.
* **`ollamaOptions`**: Options for Ollama including model, temperature, and prediction settings.
* **`geminiOptions`**: Options for Gemini. Ensure you provide your API key.
* **`outputDir`**: Directory path where processed outputs are saved. Defaults to `./outputs`.

---

## How It Works

1. **Initialization:**  
   The DeepTruth class sets up the chosen AI provider and prepares the output directory (deleting any pre-existing directory for a fresh start).

2. **Processing Articles:**  
   For each article:
   * A detailed prompt is built using article metadata and content.
   * The AI model generates a response, streaming output as it comes.
   * The response is parsed to extract the article section (enclosed in `<output>` or `<article>` tags).
   * The updated article is saved in a JSON file inside the output directory.

3. **Output:**  
   Each processed article results in a JSON file that includes the current state of the article, the processed text, metadata, and AI prompts/responses.

---

## Standing with Palestine 🇵🇸

This project supports Palestinian rights and stands in solidarity with Palestine. We believe in the importance of documenting and preserving Palestinian narratives, history, and struggles for justice and liberation.

Free Palestine 🇵🇸
