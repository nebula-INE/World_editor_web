import React, { useRef, useState } from 'react';
import { X, FilePlus2, FolderOpen, Save, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { parseStory, WORK_KINDS, STORY_BLOCK_TYPES, type AxralStoryV1, type StoryBlock, type WorkKind, type StoryBlockType } from '../core/story';
import { addChapter, renameChapter, reorderChapter, deleteChapter, addScene, renameScene, reorderScene, deleteScene, addBlock, updateBlock, reorderBlock, deleteBlock } from '../core/story-editing';
import { parseStoryFileText, serializeStoryFile, storyFilename } from '../core/story-file';

type Props = { onClose: () => void };
const uid = () => globalThis.crypto?.randomUUID?.() ?? `axral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyStory = (): AxralStoryV1 => ({format:'axral-story',schema_version:1,work_id:uid(),title:'無題の物語',kind:'novel',chapters:[]});
const button = 'rounded border border-[#3a3f4a] bg-[#242832] px-2 py-1 text-xs hover:bg-[#303644] disabled:opacity-30';
export const StoryAuthoring: React.FC<Props> = ({onClose}) => {
  const [story,setStory] = useState<AxralStoryV1>(emptyStory);
  const [selectedChapter,setSelectedChapter] = useState<string|null>(null);
  const [selectedScene,setSelectedScene] = useState<string|null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [message,setMessage] = useState('新しい物語を作成しました。');
  const chapter = story.chapters.find(c=>c.id===selectedChapter) ?? story.chapters[0];
  const scene = chapter?.scenes.find(s=>s.id===selectedScene) ?? chapter?.scenes[0];
  const change = (fn:(s:AxralStoryV1)=>AxralStoryV1) => { try { const next=fn(story);setStory(next);setMessage('未保存の変更があります。'); } catch(e) { setMessage(e instanceof Error?e.message:String(e)); } };
  const openNew = () => { if (story.chapters.length && !window.confirm('現在の物語を閉じて新規作成しますか？保存していない変更は失われます。')) return; setStory(emptyStory());setSelectedChapter(null);setSelectedScene(null);setMessage('新しい物語を作成しました。'); };
  const openFile = () => input.current?.click();
  const onFile = async (event:React.ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try { const parsed=parseStoryFileText(await file.text());setStory(parsed);setSelectedChapter(parsed.chapters[0]?.id??null);setSelectedScene(parsed.chapters[0]?.scenes[0]?.id??null);setMessage(`読み込みました: ${file.name}`); }
    catch(e) { setMessage(e instanceof Error?e.message:String(e)); }
  };
  const save = () => { try { const blob=new Blob([serializeStoryFile(story)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=storyFilename(story.title);a.click();URL.revokeObjectURL(url);setMessage('物語ファイルを書き出しました。'); } catch(e) {setMessage(e instanceof Error?e.message:String(e));} };
  const move = (index:number, delta:number, length:number, fn: (to:number)=>void) => {const to=index+delta;if(to>=0&&to<length)fn(to);};
  return <div className="fixed inset-0 z-[100] flex flex-col bg-[#121418] text-gray-200">
    <input ref={input} type="file" accept=".axral-story.json,application/json" className="hidden" onChange={onFile}/>
    <header className="flex items-center justify-between border-b border-[#323640] bg-[#181B20] px-4 py-3">
      <div><div className="font-semibold text-white">Axral Story Authoring</div><div className="text-xs text-gray-400">世界設定プロジェクトとは独立した物語ファイル</div></div>
      <div className="flex flex-wrap gap-2"><button className={button} onClick={openNew}><FilePlus2 className="mr-1 inline h-3 w-3"/>新規</button><button className={button} onClick={openFile}><FolderOpen className="mr-1 inline h-3 w-3"/>開く</button><button className={button} onClick={save}><Save className="mr-1 inline h-3 w-3"/>保存</button><button className={button} onClick={onClose}><X className="mr-1 inline h-3 w-3"/>閉じる</button></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]"><label className="text-xs text-gray-400">作品タイトル<input className="mt-1 w-full rounded border border-[#3a3f4a] bg-[#1b1e24] px-3 py-2 text-sm text-white" value={story.title} onChange={e=>setStory(s=>({...s,title:e.target.value}))}/></label>
      <label className="text-xs text-gray-400">作品種別<select className="mt-1 w-full rounded border border-[#3a3f4a] bg-[#1b1e24] px-3 py-2 text-sm text-white" value={story.kind} onChange={e=>setStory(s=>({...s,kind:e.target.value as WorkKind}))}>{WORK_KINDS.map(k=><option key={k} value={k}>{({novel:'小説',screenplay:'脚本',audio_drama:'音声ドラマ',game_scenario:'ゲームシナリオ',trpg_scenario:'TRPGシナリオ',storyboard:'絵コンテ'} as Record<string,string>)[k]}</option>)}</select></label></div>
      <div className="grid min-h-[280px] flex-1 gap-3 lg:grid-cols-[230px_260px_minmax(0,1fr)]">
        <section className="rounded border border-[#30343e] bg-[#191c22] p-3"><div className="mb-2 flex items-center justify-between font-semibold">章 <button className={button} onClick={()=>{const id=uid();change(s=>addChapter(s,id,`第${s.chapters.length+1}章`));setSelectedChapter(id);setSelectedScene(null);}}><Plus className="inline h-3 w-3"/>追加</button></div>
          <div className="space-y-1">{story.chapters.map((c,i)=><div key={c.id} className={`rounded p-2 ${chapter?.id===c.id?'bg-indigo-950/70 border border-indigo-700':'hover:bg-[#242832]'}`}><button className="w-full truncate text-left text-sm" onClick={()=>{setSelectedChapter(c.id);setSelectedScene(c.scenes[0]?.id??null);}}>{i+1}. {c.title}</button><div className="mt-2 flex gap-1"><button className={button} title="上へ" onClick={()=>move(i,-1,story.chapters.length,to=>change(s=>reorderChapter(s,c.id,to)))}><ChevronUp className="h-3 w-3"/></button><button className={button} title="下へ" onClick={()=>move(i,1,story.chapters.length,to=>change(s=>reorderChapter(s,c.id,to)))}><ChevronDown className="h-3 w-3"/></button><button className={button} onClick={()=>{if(window.confirm('この章と配下のシーン・本文を削除しますか？')){change(s=>deleteChapter(s,c.id));if(selectedChapter===c.id){setSelectedChapter(null);setSelectedScene(null);}}}}><Trash2 className="h-3 w-3"/></button></div></div>)}</div>
          {chapter&&<label className="mt-3 block text-xs text-gray-400">選択中の章名<input className="mt-1 w-full rounded border border-[#3a3f4a] bg-[#111318] px-2 py-2 text-sm text-white" value={chapter.title} onChange={e=>change(s=>renameChapter(s,chapter.id,e.target.value))}/></label>}
        </section>
        <section className="rounded border border-[#30343e] bg-[#191c22] p-3"><div className="mb-2 flex items-center justify-between font-semibold">シーン <button className={button} disabled={!chapter} onClick={()=>{if(!chapter)return;const id=uid();change(s=>addScene(s,chapter.id,id,`シーン ${chapter.scenes.length+1}`));setSelectedScene(id);}}><Plus className="inline h-3 w-3"/>追加</button></div>
          {!chapter&&<p className="text-xs text-gray-500">先に章を追加してください。</p>}
          {chapter?.scenes.map((s,i)=><div key={s.id} className={`mb-1 rounded p-2 ${scene?.id===s.id?'bg-indigo-950/70 border border-indigo-700':'hover:bg-[#242832]'}`}><button className="w-full truncate text-left text-sm" onClick={()=>setSelectedScene(s.id)}>{i+1}. {s.title}</button><div className="mt-2 flex gap-1"><button className={button} onClick={()=>move(i,-1,chapter.scenes.length,to=>change(v=>reorderScene(v,s.id,to)))}><ChevronUp className="h-3 w-3"/></button><button className={button} onClick={()=>move(i,1,chapter.scenes.length,to=>change(v=>reorderScene(v,s.id,to)))}><ChevronDown className="h-3 w-3"/></button><button className={button} onClick={()=>{if(window.confirm('このシーンの本文を削除しますか？')){change(v=>deleteScene(v,s.id));if(selectedScene===s.id)setSelectedScene(null);}}}><Trash2 className="h-3 w-3"/></button></div></div>)}
          {scene&&<label className="mt-3 block text-xs text-gray-400">選択中のシーン名<input className="mt-1 w-full rounded border border-[#3a3f4a] bg-[#111318] px-2 py-2 text-sm text-white" value={scene.title} onChange={e=>change(s=>renameScene(s,scene.id,e.target.value))}/></label>}
        </section>
        <section className="min-w-0 rounded border border-[#30343e] bg-[#191c22] p-3"><div className="mb-3 flex items-center justify-between"><div className="font-semibold">本文ブロック</div><button className={button} disabled={!scene} onClick={()=>{if(!scene)return;const id=uid();change(s=>addBlock(s,scene.id,{id,type:'prose',text:''}));}}><Plus className="inline h-3 w-3"/>本文を追加</button></div>
          {!scene&&<p className="text-xs text-gray-500">シーンを追加または選択してください。</p>}
          <div className="space-y-3">{scene?.blocks.map((b,i)=><article key={b.id} className="rounded border border-[#343945] bg-[#111318] p-3"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-xs text-gray-500">ブロック {i+1}</span><select className="rounded border border-[#3a3f4a] bg-[#20232a] px-2 py-1 text-xs" value={b.type} onChange={e=>change(s=>updateBlock(s,b.id,{type:e.target.value as StoryBlockType}))}>{STORY_BLOCK_TYPES.map(t=><option key={t} value={t}>{({prose:'地の文',dialogue:'台詞',narration:'ナレーション',direction:'演出指示',note:'メモ'} as Record<string,string>)[t]}</option>)}</select><button className={button} onClick={()=>move(i,-1,scene.blocks.length,to=>change(s=>reorderBlock(s,b.id,to)))}><ChevronUp className="h-3 w-3"/></button><button className={button} onClick={()=>move(i,1,scene.blocks.length,to=>change(s=>reorderBlock(s,b.id,to)))}><ChevronDown className="h-3 w-3"/></button><button className={button} onClick={()=>{if(window.confirm('このブロックを削除しますか？'))change(s=>deleteBlock(s,b.id));}}><Trash2 className="h-3 w-3"/></button></div><textarea className="min-h-28 w-full resize-y rounded border border-[#30343e] bg-[#1a1d23] p-3 text-sm leading-6 text-gray-100" value={b.text} placeholder="ここに本文を入力…" onChange={e=>change(s=>updateBlock(s,b.id,{text:e.target.value}))}/>{b.type==='dialogue'&&<label className="mt-2 block text-xs text-gray-400">話者ID（任意）<input className="mt-1 w-full rounded border border-[#3a3f4a] bg-[#1a1d23] px-2 py-1 text-sm text-white" value={b.character_id??''} onChange={e=>change(s=>updateBlock(s,b.id,{character_id:e.target.value||null}))}/></label>}</article>)}</div>
        </section>
      </div>
      <div role="status" className="border-t border-[#30343e] pt-2 text-xs text-gray-400">{message} · 保存形式: .axral-story.json · 作品ID: {story.work_id}</div>
    </div>
  </div>;
};
