/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter'); // included in ask-sdk
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');
const { Configuration, OpenAIApi } = require('openai');
const keys = require('./keys');
const languageStrings = {
  'en': require('./languages/en')
}

const config = new Configuration({
    apiKey: keys.OPEN_AI_KEY
});

const openai = new OpenAIApi(config);

const DOCUMENT_ID = "visual-response";

// work in progress for screen enabled alexa devices
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
                        "url": "https://inteligenciadascoisas.com/post/20221209-t%c3%a1-assustado-com-as-evolu%c3%a7%c3%b5es-das-ias-olha-ent%c3%a3o-esse-chat-gtp/capa.jpg",
                        "size": "large"
                    }
                ]
            },
            "textContent": {
                "primaryText": {
                    "type": "PlainText",
                    "text": "texto"
                }
            },
            "logoUrl": "https://openaichatgpt.com.br/wp-content/uploads/2022/12/cxv1.png",
            "hintText": "Try asking, \"Question, what is the Linux command to shut down the PC?\""
        }
    }
};

// work in progress for screen enabled alexa devices
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

// launchrequest intent handler
const LaunchRequest = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const speechOutput = requestAttributes.t('LAUNCH_MESSAGE');
        const reprompt = requestAttributes.t('LAUNCH_MESSAGE')
        
        // work in progress for screen enabled alexa devices
        if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
            datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Alexa-hosted ChatGPT!"
            // generate the APL RenderDocument directive that will be returned from your skill
            const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);
            // add the RenderDocument directive to the responseBuilder
            handlerInput.responseBuilder.addDirective(aplDirective);
        }
        
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};

// chatgptintent handler from user utterance
const ChatGptIntent = {
    canHandle(handlerInput) {
        console.log("DEBUG: ChatGptIntent handler");
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ChatGptIntent';
    },
    async handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        console.log("DEBUG: REQUEST TYPE ", Alexa.getRequestType(handlerInput.requestEnvelope))
        console.log("DEBUG: INTENT NAME ", Alexa.getIntentName(handlerInput.requestEnvelope))
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const question = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question');
        
        try {
            const response = await connectChatGPT(question);
            if (question && !response) {
                console.log("[[[[DEBUG: ChatGptIntent: No response from OpenAI", response, " ]]]]")
                return handlerInput.responseBuilder
                    .speak(requestAttributes.t('NO_RESPONSE'))
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            } else if (!question && response){
                console.log("[[[[DEBUG: ChatGptIntent: No question from user: ", question, " ]]]]")
                return handlerInput.responseBuilder
                    .speak(requestAttributes.t('NO_QUESTION'))
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            } else if (question && response) {
                const speakOutput = response;
                console.log("[[[[DEBUG: ChatGptIntent: Reponse from OpenAI", response, " ]]]]")
                
                // work in progress for screen enabled alexa devices
                if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) {
                    datasource.headlineTemplateData.properties.textContent.primaryText.text = "Welcome to Alexa-hosted ChatGPT!"
                    // generate the APL RenderDocument directive that will be returned from your skill
                    const aplDirective = createDirectivePayload(DOCUMENT_ID, datasource);
                    // add the RenderDocument directive to the responseBuilder
                    handlerInput.responseBuilder.addDirective(aplDirective);
                }
                
                return handlerInput.responseBuilder
                    .speak(speakOutput)
                    .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                    .withShouldEndSession(false)
                    .getResponse();
            }
        
        } catch (error) {
            console.error("Error while calling OpenAI API: ", error);
            // Handle error, maybe send a generic response to the user or a prompt to retry
            return handlerInput.responseBuilder
                .speak(requestAttributes.t('OPENAI_ERROR_MESSAGE'))
                .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
                .withShouldEndSession(false)
                .getResponse();
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
    handle(handlerInput) {
        console.log("Incoming Request: ", JSON.stringify(handlerInput.requestEnvelope));
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        return handlerInput.responseBuilder
            .speak(requestAttributes.t('FALLBACK_MESSAGE_OUTSIDE_CHAT'))
            .reprompt(requestAttributes.t('CONTINUE_MESSAGE'))
            .getResponse();
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