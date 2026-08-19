import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

export type AIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';
export interface AIModelInfo { id:string; name:string; sizeMb:number; contextLength:number; runtime:'webgpu'; installed:boolean; }
export interface GenerationOptions { temperature?:number; maxTokens?:number; signal?:AbortSignal; }
export interface LocalAIEngine { getStatus():AIStatus; getModel():AIModelInfo|null; isSupported():boolean; load(model:AIModelInfo, onProgress?: (progress:number, text?:string)=>void):Promise<void>; generate(prompt:string, options?:GenerationOptions):Promise<string>; unload():Promise<void>; }

/** Real browser-local inference via WebLLM/WebGPU. No cloud inference. */
export class BrowserLocalAI implements LocalAIEngine {
 private status:AIStatus='idle'; private model:AIModelInfo|null=null; private engine:MLCEngine|null=null;
 getStatus(){return this.status;} getModel(){return this.model;}
 isSupported(){return typeof navigator!=='undefined' && 'gpu' in navigator;}
 async load(model:AIModelInfo, onProgress?: (progress:number, text?:string)=>void){
  this.status='loading';
  if(!this.isSupported()){this.status='error';throw new Error('WebGPU is not available on this device/browser.');}
  try{
   this.engine=await CreateMLCEngine(model.id,{initProgressCallback:(report:{progress?:number;text?:string})=>onProgress?.(report.progress??0,report.text)});
   this.model=model;this.status='ready';onProgress?.(1,'Local model ready.');
  }catch(e){this.status='error';this.engine=null;throw new Error(`Local model could not be loaded: ${e instanceof Error?e.message:String(e)}`);}
 }
 async generate(prompt:string, options:GenerationOptions={}){
  if(!this.engine||this.status!=='ready')throw new Error('Local AI model is not ready.');
  this.status='generating';
  try{const r=await this.engine.chat.completions.create({messages:[{role:'system',content:'You are MindMesh, a private offline assistant. Be concise and honest.'},{role:'user',content:prompt}],temperature:options.temperature??0.7,max_tokens:options.maxTokens??512});return r.choices[0]?.message?.content??'';}
  finally{this.status='ready';}
 }
 async unload(){if(this.engine)await this.engine.unload();this.engine=null;this.model=null;this.status='idle';}
}
export function getBrowserAIInfo(){return {webgpu:typeof navigator!=='undefined'&&'gpu'in navigator,secureContext:typeof window!=='undefined'?window.isSecureContext:false};}
