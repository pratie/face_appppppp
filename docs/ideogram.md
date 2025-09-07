Set the REPLICATE_API_TOKEN environment variable

export REPLICATE_API_TOKEN=<paste-your-token-here>

Visibility

Copy
Learn more about authentication

Install Replicate’s Node.js client library

npm install replicate

Copy
Learn more about setup
Run ideogram-ai/ideogram-character using Replicate’s API. Check out the model's schema for an overview of inputs and outputs.

import { writeFile } from "fs/promises";
import Replicate from "replicate";
const replicate = new Replicate();

const input = {
    prompt: "a close up photo of a woman in a fashion magazine photoshoot",
    character_reference_image: "https://replicate.delivery/pbxt/NUKxQppU8C2sCfleK0lGVI0vt9P3swKz3MnKs1z9fnHkdAV2/0_1.webp"
};

const output = await replicate.run("ideogram-ai/ideogram-character", { input });

// To access the file URL:
console.log(output.url());
//=> "https://replicate.delivery/.../output.png"

// To write the file to disk:
await writeFile("output.png", output);
//=> output.png written to disk

Authentication
Whenever you make an API request, you need to authenticate using a token. A token is like a password that uniquely identifies your account and grants you access.

The following examples all expect your Replicate access token to be available from the command line. Because tokens are secrets, they should not be in your code. They should instead be stored in environment variables. Replicate clients look for the REPLICATE_API_TOKEN environment variable and use it if available.

To set this up you can use:

export REPLICATE_API_TOKEN=<paste-your-token-here>

Visibility

Copy
Some application frameworks and tools also support a text file named .env which you can edit to include the same token:

REPLICATE_API_TOKEN=<paste-your-token-here>

Visibility

Copy
The Replicate API uses the Authorization HTTP header to authenticate requests. If you’re using a client library this is handled for you.

You can test that your access token is setup correctly by using our account.get endpoint:

What is cURL?
curl https://api.replicate.com/v1/account -H "Authorization: Bearer $REPLICATE_API_TOKEN"
# {"type":"user","username":"aron","name":"Aron Carroll","github_url":"https://github.com/aron"}

Copy
If it is working correctly you will see a JSON object returned containing some information about your account, otherwise ensure that your token is available:

echo "$REPLICATE_API_TOKEN"
# "r8_xyz"

Copy
Setup
NodeJS supports two module formats ESM and CommonJS. Below details the setup for each environment. After setup, the code is identical regardless of module format.

ESM
First you’ll need to ensure you have a NodeJS project:

npm create esm -y

Copy
Then install the replicate JavaScript library using npm:

npm install replicate

Copy
To use the library, first import and create an instance of it:

import Replicate from "replicate";

const replicate = new Replicate();

Copy
This will use the REPLICATE_API_TOKEN API token you’ve setup in your environment for authorization.

CommonJS
First you’ll need to ensure you have a NodeJS project:

npm create -y

Copy
Then install the replicate JavaScript library using npm:

npm install replicate

Copy
To use the library, first import and create an instance of it:

const Replicate = require("replicate");

const replicate = new Replicate();

Copy
This will use the REPLICATE_API_TOKEN API token you’ve setup in your environment for authorization.

Run the model
Use the replicate.run() method to run the model:

const input = {
    prompt: "a close up photo of a woman in a fashion magazine photoshoot",
    character_reference_image: "https://replicate.delivery/pbxt/NUKxQppU8C2sCfleK0lGVI0vt9P3swKz3MnKs1z9fnHkdAV2/0_1.webp"
};

const output = await replicate.run("ideogram-ai/ideogram-character", { input });

// To access the file URL:
console.log(output.url());
//=> "https://replicate.delivery/.../output.png"

// To write the file to disk:
await writeFile("output.png", output);
//=> output.png written to disk

Copy
You can learn about pricing for this model on the model page.

The run() function returns the output directly, which you can then use or pass as the input to another model. If you want to access the full prediction object (not just the output), use the replicate.predictions.create() method instead. This will include the prediction id, status, logs, etc.

File inputs
This model accepts files as input. You can provide a file as input using a URL, a local file on your computer, or a base64 encoded object:

Option 1: Hosted file
Use a URL as in the earlier example:

const character_reference_image = "https://replicate.delivery/pbxt/NUKxQppU8C2sCfleK0lGVI0vt9P3swKz3MnKs1z9fnHkdAV2/0_1.webp";

Copy
This is useful if you already have an image hosted somewhere on the internet.

Option 2: Local file
You can provide Replicate with a Blob, File or Buffer object and the library will handle the upload for you:

import { readFile } from "node:fs/promises";
const character_reference_image = await readFile("./path/to/my/character_reference_image.webp");

Copy
Option 3: Data URI
You can create a data URI consisting of the base64 encoded data for your file, but this is only recommended if the file is < 1mb

import { readFile } from "node:fs/promises";
const data = (await readFile("./character_reference_image.webp")).toString("base64");
const character_reference_image = `data:application/octet-stream;base64,${data}`;

Copy
Then, pass character_reference_image as part of the input:

const input = {
    prompt: "a close up photo of a woman in a fashion magazine photoshoot",
    character_reference_image: character_reference_image
};

const output = await replicate.run("ideogram-ai/ideogram-character", { input });

// To access the file URL:
console.log(output.url());
//=> "https://replicate.delivery/.../output.png"

// To write the file to disk:
await writeFile("output.png", output);
//=> output.png written to disk

Copy
Prediction lifecycle
Running predictions and trainings can often take significant time to complete, beyond what is reasonable for an HTTP request/response.

When you run a model on Replicate, the prediction is created with a “starting” state, then instantly returned. This will then move to "processing" and eventual one of “successful”, "failed" or "canceled".

Starting
Running
Succeeded
Failed
Canceled
You can explore the prediction lifecycle by using the predictions.get() method to retrieve the latest version of the prediction until completed.

Show example
Webhooks
Webhooks provide real-time updates about your prediction. Specify an endpoint when you create a prediction, and Replicate will send HTTP POST requests to that URL when the prediction is created, updated, and finished.

It is possible to provide a URL to the predictions.create() function that will be requested by Replicate when the prediction status changes. This is an alternative to polling.

To receive webhooks you’ll need a web server. The following example uses Hono, a web standards based server, but this pattern applies to most frameworks.

Show example
Then create the prediction passing in the webhook URL and specify which events you want to receive out of "start", "output", ”logs” and "completed".

const input = {
    prompt: "a close up photo of a woman in a fashion magazine photoshoot",
    character_reference_image: "https://replicate.delivery/pbxt/NUKxQppU8C2sCfleK0lGVI0vt9P3swKz3MnKs1z9fnHkdAV2/0_1.webp"
};

const callbackURL = `https://my.app/webhooks/replicate`;
await replicate.predictions.create({
  model: "ideogram-ai/ideogram-character",
  input: input,
  webhook: callbackURL,
  webhook_events_filter: ["completed"],
});

// The server will now handle the event and log:
// => {"id": "xyz", "status": "successful", ... }

Copy
ℹ️ The replicate.run() method is not used here. Because we're using webhooks, and we don’t need to poll for updates.

Co-ordinating between a prediction request and a webhook response will require some glue. A simple implementation for a single JavaScript server could use an event emitter to manage this.

Show example
From a security perspective it is also possible to verify that the webhook came from Replicate. Check out our documentation on verifying webhooks for more information.

Access a prediction
You may wish to access the prediction object. In these cases it’s easier to use the replicate.predictions.create() or replicate.deployments.predictions.create() functions which will return the prediction object.

Though note that these functions will only return the created prediction, and it will not wait for that prediction to be completed before returning. Use replicate.predictions.get() to fetch the latest prediction.

const input = {
    prompt: "a close up photo of a woman in a fashion magazine photoshoot",
    character_reference_image: "https://replicate.delivery/pbxt/NUKxQppU8C2sCfleK0lGVI0vt9P3swKz3MnKs1z9fnHkdAV2/0_1.webp"
};
const prediction = replicate.predictions.create({
  model: "ideogram-ai/ideogram-character",
  input
});
// { "id": "xyz123", "status": "starting", ... }

Copy
Cancel a prediction
You may need to cancel a prediction. Perhaps the user has navigated away from the browser or canceled your application. To prevent unnecessary work and reduce runtime costs you can use the replicate.predictions.cancel function and pass it a prediction id.

await replicate.predictions.cancel(prediction.id);

Input schema
Table
JSON
mask
uri
A black and white image. Black pixels are inpainted, white pixels are preserved. The mask will be resized to match the image size.

seed
integer
Random seed. Set for reproducible generation

Maximum
2147483647
image
uri
An image file to use for inpainting. You must also use a mask.

prompt
string
Text prompt for image generation

resolution
string
Resolution. Overrides aspect ratio. Ignored if an inpainting image is given.

Default
"None"
style_type
string
The character style type. Auto, Fiction, or Realistic.

Default
"Auto"
aspect_ratio
string
Aspect ratio. Ignored if a resolution or inpainting image is given.

Default
"1:1"
rendering_speed
string
Rendering speed. Turbo for faster and cheaper generation, quality for higher quality and more expensive generation, default for balanced.

Default
"Default"
magic_prompt_option
string
Magic Prompt will interpret your prompt and optimize it to maximize variety and quality of the images generated. You can also use it to write prompts in different languages.

Default
"Auto"
character_reference_image
uri
An image to use as a character reference.

Output schema
Table
JSON
Type
uri