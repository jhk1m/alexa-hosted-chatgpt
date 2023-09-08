# Alexa Skill with ChatGPT

This repository contains an example of how to host OpenAI's ChatGPT language model on Alexa devices.

## How it works

This code connects to the OpenAI ChatGPT API and sends Alexa's questions to the model, which processes them and returns the answers. Then, these responses are transmitted back to Alexa and presented to the user.

## Configuration

You will need to obtain an API key from OpenAI to use the ChatGPT model. More information on how to do this can be found in the OpenAI API documentation.

Once you have your API key, simply insert it into the lambda/keys.js file in the designated location.

## Running the example

This example was developed using Amazon's ASK CLI. To run it, you will need to install the ASK CLI and configure your Amazon Developer account.

Once configured, simply run the following commands in the terminal:

```
ask init
ask deploy
```

This will deploy your Skill to your Amazon Developer account and make it available for use with Alexa.

## Final considerations

This is just a basic example of how to have a conversation with Alexa-hosted ChatGPT. I am currently working on Alexa-hosted ChatGPT that are industry focused. Some of my prompts include health nutritionist, pet veterinarian, ai consultant, and etc. I found assigning specific roles, rules, and protocols for GPT to follow really helps focus on the topic and provide personalized response based on user's question.
