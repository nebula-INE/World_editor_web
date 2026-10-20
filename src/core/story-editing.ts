/** Immutable outline and block operations for Axral Story v1. */
import { parseStory, type AxralStoryV1, type StoryBlock } from './story';
function copy(value: AxralStoryV1): AxralStoryV1 { return JSON.parse(JSON.stringify(parseStory(value))) as AxralStoryV1; }
function chapterOf(story: AxralStoryV1, id: string) { const x=story.chapters.find(v=>v.id===id); if(!x) throw new Error('章が見つかりません: '+id); return x; }
function sceneOf(story: AxralStoryV1, id: string) { for(const c of story.chapters){const x=c.scenes.find(v=>v.id===id);if(x)return x;} throw new Error('シーンが見つかりません: '+id); }
function blockOwner(story: AxralStoryV1, id: string) { for(const c of story.chapters)for(const s of c.scenes)if(s.blocks.some(b=>b.id===id))return s; throw new Error('ブロックが見つかりません: '+id); }
function reorder<T>(items:T[],from:number,to:number):void { if(!Number.isInteger(to)||to<0||to>=items.length)throw new Error('移動先の順序が範囲外です。'); const [item]=items.splice(from,1);items.splice(to,0,item); }
export function addChapter(v:AxralStoryV1,id:string,title:string):AxralStoryV1 {const s=copy(v);s.chapters.push({id,title,order:s.chapters.length,scenes:[]});return parseStory(s);}
export function renameChapter(v:AxralStoryV1,id:string,title:string):AxralStoryV1 {const s=copy(v);chapterOf(s,id).title=title;return parseStory(s);}
export function reorderChapter(v:AxralStoryV1,id:string,to:number):AxralStoryV1 {const s=copy(v),from=s.chapters.findIndex(x=>x.id===id);if(from<0)throw new Error('章が見つかりません: '+id);reorder(s.chapters,from,to);s.chapters.forEach((x,i)=>x.order=i);return parseStory(s);}
export function deleteChapter(v:AxralStoryV1,id:string):AxralStoryV1 {const s=copy(v),i=s.chapters.findIndex(x=>x.id===id);if(i<0)throw new Error('章が見つかりません: '+id);s.chapters.splice(i,1);s.chapters.forEach((x,n)=>x.order=n);return parseStory(s);}
export function addScene(v:AxralStoryV1,chapterId:string,id:string,title:string):AxralStoryV1 {const s=copy(v),c=chapterOf(s,chapterId);c.scenes.push({id,title,order:c.scenes.length,blocks:[]});return parseStory(s);}
export function renameScene(v:AxralStoryV1,id:string,title:string):AxralStoryV1 {const s=copy(v);sceneOf(s,id).title=title;return parseStory(s);}
export function reorderScene(v:AxralStoryV1,id:string,to:number):AxralStoryV1 {const s=copy(v);for(const c of s.chapters){const i=c.scenes.findIndex(x=>x.id===id);if(i>=0){reorder(c.scenes,i,to);c.scenes.forEach((x,n)=>x.order=n);return parseStory(s);}}throw new Error('シーンが見つかりません: '+id);}
export function deleteScene(v:AxralStoryV1,id:string):AxralStoryV1 {const s=copy(v);for(const c of s.chapters){const i=c.scenes.findIndex(x=>x.id===id);if(i>=0){c.scenes.splice(i,1);c.scenes.forEach((x,n)=>x.order=n);return parseStory(s);}}throw new Error('シーンが見つかりません: '+id);}
export function addBlock(v:AxralStoryV1,sceneId:string,block:Omit<StoryBlock,'order'>):AxralStoryV1 {const s=copy(v),scene=sceneOf(s,sceneId);scene.blocks.push({...block,order:scene.blocks.length});return parseStory(s);}
export function updateBlock(v:AxralStoryV1,id:string,changes:Partial<Pick<StoryBlock,'type'|'text'|'character_id'|'entity_refs'>>):AxralStoryV1 {const s=copy(v),scene=blockOwner(s,id),block=scene.blocks.find(x=>x.id===id)!;Object.assign(block,changes);return parseStory(s);}
export function reorderBlock(v:AxralStoryV1,id:string,to:number):AxralStoryV1 {const s=copy(v),scene=blockOwner(s,id),i=scene.blocks.findIndex(x=>x.id===id);reorder(scene.blocks,i,to);scene.blocks.forEach((x,n)=>x.order=n);return parseStory(s);}
export function deleteBlock(v:AxralStoryV1,id:string):AxralStoryV1 {const s=copy(v),scene=blockOwner(s,id),i=scene.blocks.findIndex(x=>x.id===id);scene.blocks.splice(i,1);scene.blocks.forEach((x,n)=>x.order=n);return parseStory(s);}
