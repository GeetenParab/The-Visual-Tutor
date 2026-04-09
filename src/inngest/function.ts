import { Sandbox } from "@e2b/code-interpreter"
import { gemini, createTool, createNetwork } from "@inngest/agent-kit";
import { Agent, createAgent } from "@inngest/agent-kit";
import { inngest } from "./client";
import { z } from "zod"; // Ensure z is imported
import { getsandbox, lastAssistantTextMessageContent } from "./utils";
import { PROMPT } from "../../prompt";

export const helloWorld = inngest.createFunction(
  { 
    id: "hello-world",
    throttle: {
      limit: 4,       // Matches your Gemini RPM limit
      period: "1m",   
      burst: 0        // No bursts to stay strictly safe
    }
  },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("explain");
      return sandbox.sandboxId;
    })

    const codeAgent = createAgent({
      name: "code-agent",
      description:'An expert coding agent',
      system: PROMPT,
      model: gemini({ model: "gemini-2.5-flash-lite" }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await getsandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });

                return result.stdout;
              } catch (e) {
                console.error(
                  `command failed : ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
                );
                return `command failed: ${e} \n stdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`
              }
            })
          }
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string()
              }),
            )
          }),
          handler: async ({ files }, { step, network }) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getsandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }
                return updatedFiles;
              } catch (e) {
                console.error(e);
                return "Failed to update files";
              }
            });
            if (typeof newFiles === "object"){
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name:"readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({files},{step})=>{
            return await step?.run("readFiles", async ()=>{
              try{
                const sandbox = await getsandbox(sandboxId);
                const contents = [];
                for(const file of files){
                  const content = await sandbox.files.read(file);
                  contents.push({path:file,content});
                }
                return JSON.stringify(contents);
              }catch(e){
                  return "Error: "+ e
              }
            })
          },
        })
      ],
          lifecycle:{
            onResponse: async({ result,network})=>{
              const lastAssistantMessageText = lastAssistantTextMessageContent(result);

              if(lastAssistantMessageText && network){
                if(lastAssistantMessageText.includes("<task_summary>")){
                  network.state.data.summary = lastAssistantMessageText;
                }
              }
              return result;
            }
          }
    });

    const network = createNetwork({
      name:"coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({network})=>{
        const summary = network.state.data.summary;

        if(summary){
          return;
        }

        return codeAgent
      }
    })

    const result = await network.run(event.data.value);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getsandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    })

    return { 
      url: sandboxUrl,
      title: "Fragment",
      file: result.state.data.files,
      summary: result.state.data.summary
     }
  },
);