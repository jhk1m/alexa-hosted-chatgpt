const Alexa = require('ask-sdk-core');
const { Configuration, OpenAIApi } = require('openai');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const languageStrings = {
  'en': require('./languages/en')
}
const keys = require('./keys');

// Validate OpenAI key
if (!keys.OPEN_AI_KEY) {
    throw new Error("OpenAI key is missing");
}

// OpenAI Configuration
const config = new Configuration({ apiKey: keys.OPEN_AI_KEY });
const openai = new OpenAIApi(config);

const DOCUMENT_ID = "visual-response";
const datasource = {
    "headlineTemplateData": {
        "type": "object",
        "objectId": "headlineSample",
        "properties": {
            "backgroundImage": {
                "contentDescription": null,
                "smallSourceUrl": null,
                "largeSourceUrl": null,
                "sources": [
                    {
                        "url": "import_background_image_here.jpg",
                        "size": "large"
                    }
                ]
            },
            "textContent": {
                "primaryText": {
                    "type": "PlainText",
                    "text": "text"
                }
            },
            "logoUrl": "import_logo_here.png",
            "hintText": "Try asking, \"Question, what is the Linux command to shut down the PC?\""
        }
    }
};

const createDirectivePayload = (aplDocumentId, dataSources = {}, tokenId = "documentToken") => {
    return {
        type: "Alexa.Presentation.APL.RenderDocument",
        token: tokenId,
        document: {
            type: "Link",
            src: "doc://alexa/apl/documents/" + aplDocumentId
        },
        datasources: dataSources
    }
};

// connect to chatgpt and specified model and get response
async function connectChatGPT(question) {
    const response =  await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: question,
        temperature: 0,
        max_tokens: 1500,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.0
    });

    return response.data.choices[0].text;
}

function handleAPL(handlerInput) {
    // Check if the device supports APL (Alexa Presentation Language)
    if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
        // Ensure datasource is properly defined somewhere in your code
        if (datasource && datasource.headlineTemplateData && datasource.headlineTemplateData.properties && datasource.headlineTemplateData.properties.textContent) {
            datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Gen-AI Enhanced Alexa!";
        } else {
            console.warn("Datasource is not properly defined. Skipping APL.");
        }
        
        // Assume createDirectivePayload and DOCUMENT_ID are defined elsewhere
        const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);

        // Add the RenderDocument directive to the responseBuilder
        handlerInput.responseBuilder.addDirective(aplDirective);
    }
}

// Helper to generate standard responses
function generateResponse(handlerInput, messageKey, customMessage = null) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speakOutput = customMessage || requestAttributes.t(messageKey);

    if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
        handleAPL(handlerInput, speakOutput);
    }

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
        .withShouldEndSession(false)
        .getResponse();
}

// launchrequest intent handler
const LaunchRequest = {
    canHandle(handlerInput) {
        // Check if the incoming request is a 'LaunchRequest'
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
          handleAPL(handlerInput);
        }
        
        return handlerInput.responseBuilder
            .speak(requestAttributes.t('LAUNCH_MESSAGE'))
            .reprompt(requestAttributes.t('LAUNCH_MESSAGE'))
            .getResponse();
    }
};

// chatgptintent handler from user utterance
const ChatGptIntent = {
    canHandle(handlerInput) {
        console.log("DEBUG: ChatGptIntent handler");
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ChatGptIntent';
    },
    async handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        console.log("DEBUG: REQUEST TYPE ", Alexa.getRequestType(handlerInput.requestEnvelope))
        console.log("DEBUG: INTENT NAME ", Alexa.getIntentName(handlerInput.requestEnvelope))
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.inConversation = true;  // Set this flag when the conversation starts
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        const question = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question');
        
        try {
            const response = await connectChatGPT(question);
            if (!response) {
                console.log("[[[[DEBUG: ChatGptIntent: No response from OpenAI", response, " ]]]]")
                return generateResponse(handlerInput, 'NO_RESPONSE');
            }
            if (!question){
                console.log("[[[[DEBUG: ChatGptIntent: No question from user: ", question, " ]]]]")
                return generateResponse(handlerInput, 'NO_QUESTION');
            } 
            return generateResponse(handlerInput, null, response);
        
        } catch (error) {
            console.error("Error while calling OpenAI API: ", error);
            // Handle error, maybe send a generic response to the user or a prompt to retry
            return generateResponse(handlerInput, 'OPENAI_ERROR_MESSAGE');
        }
      },
};

const CancelAndStopIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        return handlerInput.responseBuilder
            .speak(requestAttributes.t('EXIT_MESSAGE'))
            .getResponse();
    }
};

const SessionEndedRequest = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`[[[[ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)} ]]]]]`);
        return handlerInput.responseBuilder.getResponse();
    },
};

const HelpIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

        return handlerInput.responseBuilder
            .speak(requestAttributes.t('HELP_MESSAGE'))
            .reprompt(requestAttributes.t('HELP_REPROMPT'))
            .getResponse();
  },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        console.log(`Error stack: ${error.stack}`);
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    
    return handlerInput.responseBuilder
        .speak(requestAttributes.t('ERROR_MESSAGE'))
        .reprompt(requestAttributes.t('ERROR_MESSAGE'))
        .getResponse();
    },
};

const FallbackIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
          && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent');
    },
    async handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        if (sessionAttributes.inConversation) {
            const userInput = handlerInput.requestEnvelope.request.intent.slots.any.value || requestAttributes.t('FALLBACK_REPROMPT_DURING_CHAT');
            
            try {
                const response = await connectChatGPT(userInput);
                return generateResponse(handlerInput, null, response);
            } catch (error) {
                console.error("Error while calling OpenAI API: ", error);
                // Handle error, maybe send a generic response to the user or a prompt to retry
                return generateResponse(handlerInput, 'OPENAI_ERROR_MESSAGE');
            } 
        } else {
            return generateResponse(handlerInput, 'FALLBACK_MESSAGE_OUTSIDE_CHAT');
        }
    },
};

const LocalizationInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: Alexa.getLocale(handlerInput.requestEnvelope),
            resources: languageStrings,
        });
        localizationClient.localize = function localize() {
            const args = arguments;
            const values = [];
            for (let i = 1; i < args.length; i += 1) {
                values.push(args[i]);
            }
            const value = i18n.t(args[0], {
                returnObjects: true,
                postProcess: 'sprintf',
                sprintf: values,
            });
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)];
            }
            return value;
        };
        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function translate(...args) {
            return localizationClient.localize(...args);
        };
    },
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequest,
        ChatGptIntent,
        HelpIntent,
        CancelAndStopIntent,
        FallbackIntent,
        SessionEndedRequest
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .addErrorHandlers(ErrorHandler)
    .lambda();