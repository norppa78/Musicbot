const openAi = require('openai');
const { openApiKey } = require('../../config.json');
const openAiClient = new openAi({ apiKey: process.env.OPENAI_API_KEY || openApiKey });


const removeOldAssistants = async() => {
    if (!!process.env.OPENAI_API_KEY) {
        let assistantList = await openAiClient.beta.assistants.list();
        let assistantIds = assistantList.data.map(assistant => assistant.id);

        assistantIds.forEach(async(id)  => {
        let res = await openAiClient.beta.assistants.del(id);
        console.log("removed", res);
        });
    }
}

const createAssistant = async (user) => {
    return await openAiClient.beta.assistants.create(
        {
            name: `PartyByBot_${user}`,
            instructions: `You are a music fetching service.Your job is to find song information and to answer music related questions. your job is to provide song lists using the provided functions.
            These song lists will be used by an external music playing service. Answer in user's language as concisely as possible.Always address the user as ${user}.`,
            model: "gpt-3.5-turbo-1106",
            tools: [{
                "type": "function",
                "function": {
                    "name": "getSongInfo",
                    "description": "Get listing of the songs",
                    "parameters": {
                      "type": "object",
                      "properties": {
                        "song": {
                          "type": "string",
                          "description": "name of the song"
                        },
                        "artist": {
                          "type": "string",
                          "description": "name of the artist"
                        }
                      },
                      "required": [
                        "song",
                        "artist"
                      ]
                    }
                  }
              },]
        }
    )
}

const createThread = async() => {
    return await openAiClient.beta.threads.create()
}

const createMessage = async(thread, message) => {
    return await openAiClient.beta.threads.messages.create(
        thread.id,
        { role: "user", content: message }
    )
}

const createRun = async(assistant, thread) => {
    let songObjectList = [];

    let run = await openAiClient.beta.threads.runs.create(
        thread.id,
        { assistant_id: assistant.id }
    )

    let runStatus = await openAiClient.beta.threads.runs.retrieve(
        thread.id,
        run.id
    );

  

    while (runStatus.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (runStatus.status === "requires_action" && runStatus.required_action.type === "submit_tool_outputs") {
            let toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
            let toolIds = toolCalls.map(tool => ({
                tool_call_id: tool.id,
                output: true,
              }));
            let results = toolCalls?.map(tool => tool?.function?.arguments ? JSON.parse(tool.function.arguments) : null);
            songObjectList = results?.map(track => ({
                id: null,
                title: `${track.artist} - ${track.song}`,
                source: "spotify"
            }));

            if (!!toolIds?.length) {
                await openAiClient.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    {
                    tool_outputs: toolIds,
                    }
                );
            }
        }

        runStatus = await openAiClient.beta.threads.runs.retrieve(thread.id, run.id);
    }
    return  songObjectList;
}

const getMessages = async(thread,message) => {
    return await openAiClient.beta.threads.messages.list(thread.id, message.id);
}

removeOldAssistants();

module.exports = {
    createAssistant,
    createThread,
    createMessage,
    createRun,
    getMessages
}