import { CreateMLCEngine, prebuiltAppConfig, type MLCEngine } from '@mlc-ai/web-llm';

export type AIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';
export interface AIModelInfo { id:string; name:string; sizeMb:number; contextLength:number; runtime:'webgpu'; installed:boolean; }
export interface GenerationOptions { temperature?:number; maxTokens?:number; signal?:AbortSignal; }
export interface LocalAIEngine { getStatus():AIStatus; getModel():AIModelInfo|null; isSupported():boolean; load(model:AIModelInfo, onProgress?: (progress:number, text?:string)=>void):Promise<void>; generate(prompt:string, options?:GenerationOptions):Promise<string>; unload():Promise<void>; }
export interface AIDiagnostics { secureContext:boolean; crossOriginIsolated:boolean; webgpu:boolean; adapter:boolean; storage:boolean; modelConfigured:boolean; modelUrl?:string; modelFetch?:string; notes:string[]; }

type WebLLMModelRecord = { model_id:string; model?:string; model_lib?:string; };
function configuredModel(id:string){ return prebuiltAppConfig.model_list.find((entry) => entry.model_id === id) as WebLLMModelRecord|undefined; }

/** Browser-local inference via WebLLM/WebGPU. Model weights are fetched once and cached locally. */
export class BrowserLocalAI implements LocalAIEngine {
 private status:AIStatus='idle'; private model:AIModelInfo|null=null; private engine:MLCEngine|null=null;
 getStatus(){return this.status;} getModel(){return this.model;}
 isSupported(){return typeof navigator!=='undefined' && 'gpu' in navigator;}
 async load(model:AIModelInfo, onProgress?: (progress:number, text?:string)=>void){
  this.status='loading';
  if(!this.isSupported()){this.status='error';throw new Error('WebGPU is not available on this device/browser.');}
  if(typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated){this.status='error';throw new Error('Local AI needs cross-origin isolation. Refresh after the latest MindMesh deployment, or use a browser that allows COOP/COEP headers.');}
  try{
   const entry=configuredModel(model.id);
   if(!entry) throw new Error(`Model ${model.id} is not included in this WebLLM build.`);
   onProgress?.(0.01,'Checking local model cache…');
   this.engine=await CreateMLCEngine(model.id,{appConfig:prebuiltAppConfig,initProgressCallback:(report:{progress?:number;text?:string})=>onProgress?.(report.progress??0,report.text)});
   this.model=model;this.status='ready';onProgress?.(1,'Local model ready.');
  }catch(e){this.status='error';this.engine=null;
   const reason=e instanceof Error?e.message:String(e);
   throw new Error(`Local model could not be loaded: ${reason}. The first install needs a stable internet connection and enough browser storage for the model. After successful caching, inference can run offline.`);
  }
 }
 async generate(prompt:string, options:GenerationOptions={}){
  if(!this.engine||this.status!=='ready')throw new Error('Local AI model is not ready.');
  this.status='generating';
  try{const r=await this.engine.chat.completions.create({messages:[{role:'system',content:'You are MindMesh, a private offline assistant. Be concise and honest.'},{role:'user',content:prompt}],temperature:options.temperature??0.7,max_tokens:options.maxTokens??512});return r.choices[0]?.message?.content??'';}
  finally{this.status='ready';}
 }
 async unload(){if(this.engine)await this.engine.unload();this.engine=null;this.model=null;this.status='idle';}
}

export function getBrowserAIInfo(){return {webgpu:typeof navigator!=='undefined'&&'gpu'in navigator,secureContext:typeof window!=='undefined'?window.isSecureContext:false,crossOriginIsolated:typeof crossOriginIsolated!=='undefined'&&crossOriginIsolated};}

export async function diagnoseLocalAI(model:AIModelInfo):Promise<AIDiagnostics>{
 const secureContext=typeof window!=='undefined'&&window.isSecureContext;
 const isolated=typeof crossOriginIsolated!=='undefined'&&crossOriginIsolated;
 const webgpu=typeof navigator!=='undefined'&&'gpu'in navigator;
 const notes:string[]=[];
 let adapter=false;
 if(webgpu){try{adapter=!!await (navigator as Navigator & {gpu:{requestAdapter:()=>Promise<unknown>}}).gpu.requestAdapter();}catch(e){notes.push(`WebGPU adapter request failed: ${e instanceof Error?e.message:String(e)}`);}}
 else notes.push('WebGPU API is unavailable.');
 if(!isolated) notes.push('Cross-origin isolation is disabled. Refresh after the latest MindMesh deployment.');
 let storage=false;
 try{const estimate=await navigator.storage?.estimate();storage=!!estimate; if(estimate?.quota && estimate.quota < model.sizeMb*1024*1024*1.2) notes.push(`Browser storage quota may be too small for a ${model.sizeMb} MB model.`);}catch{notes.push('Browser storage estimate unavailable.');}
 const entry=configuredModel(model.id);
 // WebLLM calls this field `model` (the model repository URL), not `model_url`.
 const modelUrl=typeof entry?.model==='string'?entry.model:undefined;
 let modelFetch='not tested';
 if(modelUrl){
   try{
     const response=await fetch(modelUrl,{method:'HEAD',cache:'no-store',mode:'cors'});
     modelFetch=`HTTP ${response.status}`;
     if(!response.ok)notes.push(`Model repository returned HTTP ${response.status}.`);
   }catch(e){
     modelFetch='blocked/failed';
     notes.push(`Model repository fetch failed: ${e instanceof Error?e.message:String(e)}`);
   }
 } else notes.push('WebLLM model repository URL is missing from the installed model configuration.');
 if(!secureContext)notes.push('The page is not a secure context; WebGPU requires HTTPS or localhost.');
 if(webgpu&&adapter&&secureContext&&isolated&&modelFetch==='HTTP 200') notes.push('Browser, WebGPU adapter, isolation and model repository look reachable.');
 return {secureContext,crossOriginIsolated:isolated,webgpu,adapter,storage,modelConfigured:!!entry,modelUrl,modelFetch,notes};
}
