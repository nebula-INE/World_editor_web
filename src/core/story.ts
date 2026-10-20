/** Portable Axral Story v1 codec, separate from the existing world-project codec. */
export const STORY_FORMAT = 'axral-story' as const;
export const STORY_SCHEMA_VERSION = 1 as const;
export const WORK_KINDS = ['novel','screenplay','audio_drama','game_scenario','trpg_scenario','storyboard'] as const;
export const STORY_BLOCK_TYPES = ['prose','dialogue','narration','direction','note'] as const;
export type WorkKind = typeof WORK_KINDS[number];
export type StoryBlockType = typeof STORY_BLOCK_TYPES[number];
export interface StoryBlock { id:string; type:StoryBlockType; order:number; text:string; character_id?:string|null; entity_refs?:string[]; [key:string]:unknown }
export interface StoryScene { id:string; title:string; order:number; blocks:StoryBlock[]; [key:string]:unknown }
export interface StoryChapter { id:string; title:string; order:number; scenes:StoryScene[]; [key:string]:unknown }
export interface AxralStoryV1 { format:typeof STORY_FORMAT; schema_version:typeof STORY_SCHEMA_VERSION; work_id:string; title:string; kind:WorkKind; chapters:StoryChapter[]; [key:string]:unknown }
export interface StoryReferenceFinding { path:string; entity_id:string; message:string }
function isRecord(v:unknown):v is Record<string,any>{return typeof v==='object'&&v!==null&&!Array.isArray(v)}
function str(v:unknown,p:string):asserts v is string{if(typeof v!=='string')throw new Error(`${p}は文字列である必要があります。`)}
function order(v:unknown,p:string,n:number):asserts v is number{if(!Number.isSafeInteger(v)||v!==n)throw new Error(`${p}は配列位置と一致する整数(${n})である必要があります。`)}
export function parseStory(value:unknown):AxralStoryV1{
 if(!isRecord(value)||value.format!==STORY_FORMAT)throw new Error('Axral Story形式ではありません。');
 if(value.schema_version!==STORY_SCHEMA_VERSION)throw new Error(`未対応のAxral Story schema_versionです: ${String(value.schema_version)}`);
 str(value.work_id,'work_id');str(value.title,'title');
 if(!WORK_KINDS.includes(value.kind))throw new Error('kindは対応する作品種別である必要があります。');
 if(!Array.isArray(value.chapters))throw new Error('chaptersは配列である必要があります。');
 const ids=new Set<string>();
 const uid=(v:unknown,p:string)=>{str(v,p);if(!v)throw new Error(`${p}は空にできません。`);if(ids.has(v))throw new Error(`IDが重複しています: ${v}`);ids.add(v)};
 value.chapters.forEach((c:unknown,ci:number)=>{const cp=`chapters[${ci}]`;if(!isRecord(c))throw new Error(`${cp}はオブジェクトである必要があります。`);uid(c.id,cp+'.id');str(c.title,cp+'.title');order(c.order,cp+'.order',ci);if(!Array.isArray(c.scenes))throw new Error(cp+'.scenesは配列である必要があります。');
 c.scenes.forEach((s:unknown,si:number)=>{const sp=`${cp}.scenes[${si}]`;if(!isRecord(s))throw new Error(sp+'はオブジェクトである必要があります。');uid(s.id,sp+'.id');str(s.title,sp+'.title');order(s.order,sp+'.order',si);if(!Array.isArray(s.blocks))throw new Error(sp+'.blocksは配列である必要があります。');
 s.blocks.forEach((b:unknown,bi:number)=>{const bp=`${sp}.blocks[${bi}]`;if(!isRecord(b))throw new Error(bp+'はオブジェクトである必要があります。');uid(b.id,bp+'.id');if(!STORY_BLOCK_TYPES.includes(b.type))throw new Error(bp+'.typeは対応するブロック種別である必要があります。');order(b.order,bp+'.order',bi);str(b.text,bp+'.text');if(b.character_id!==undefined&&b.character_id!==null)str(b.character_id,bp+'.character_id');if(b.entity_refs!==undefined&&(!Array.isArray(b.entity_refs)||!b.entity_refs.every((r:unknown)=>typeof r==='string')))throw new Error(bp+'.entity_refsは文字列配列である必要があります。');});
 });});
 return JSON.parse(JSON.stringify(value)) as AxralStoryV1;
}
export function serializeStory(value:unknown):string{return JSON.stringify(parseStory(value),null,2)+'\\n'}
export function validateStoryReferences(value:unknown,known:Set<string>):StoryReferenceFinding[]{const story=parseStory(value),out:StoryReferenceFinding[]=[];story.chapters.forEach((c,ci)=>c.scenes.forEach((s,si)=>s.blocks.forEach((b,bi)=>{const refs=[...(b.entity_refs??[])];if(b.character_id)refs.push(b.character_id);refs.forEach(ref=>{if(!known.has(ref))out.push({path:`chapters[${ci}].scenes[${si}].blocks[${bi}]`,entity_id:ref,message:`参照先の世界設定IDが見つかりません: ${ref}`})})})));return out}
