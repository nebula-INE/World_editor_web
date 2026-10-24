import type { AxralStoryV1, WorkKind, StoryBlockType } from './story';

export interface StoryTemplateOption {
  id: string;
  name: string;
  genre: string;
  kind: WorkKind;
  badge: string;
  description: string;
  create: (title?: string) => AxralStoryV1;
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `axral-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const STORY_TEMPLATES: StoryTemplateOption[] = [
  {
    id: 'three_act',
    name: 'ハリウッド三幕構成（映画・アニメ脚本）',
    genre: '映画・アニメ脚本',
    kind: 'screenplay',
    badge: '脚本・映像',
    description: 'セットアップ、対立・ミッドポイント、クライマックスの王道シナリオ構成。柱・ト書き・台詞の型が最初から揃っています。',
    create: (title = '映画・アニメ脚本') => ({
      format: 'axral-story',
      schema_version: 1,
      work_id: uid(),
      title,
      kind: 'screenplay',
      chapters: [
        {
          id: uid(),
          title: '第1幕：セットアップと契機',
          order: 0,
          scenes: [
            {
              id: uid(),
              title: 'シーン1：日常と主人公の欠落',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 メイン通り（昼）\n喧騒に包まれる街並み。行き交う人々の中に、主人公の姿がある。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「今日もいつもと同じ、退屈な一日か……」' },
                { id: uid(), type: 'direction', order: 2, text: '【SE: 突風と不協和音】\n空が一瞬にして不気味な紫色に染まり、地面が大きく揺れる。' },
                { id: uid(), type: 'dialogue', order: 3, character_id: 'Bob', text: '「おい、見ろ！ あれは……何なんだ！？」' }
              ]
            },
            {
              id: uid(),
              title: 'シーン2：インサイティング・インシデント（旅立ちの決断）',
              order: 1,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 廃墟の入り口（夕）\n煙がくすぶる瓦礫の中、古びた紋章が落ちている。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「もう後戻りはできない。真実を確かめに行くわ」' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '第2幕：葛藤とミッドポイント',
          order: 1,
          scenes: [
            {
              id: uid(),
              title: 'シーン1：試練と仲間との絆',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 渓谷の野営地（夜）\n焚き火の火の粉が静かに夜空へ舞い上がっている。' },
                { id: uid(), type: 'direction', order: 1, text: '【BGM: 静穏な弦楽器】' },
                { id: uid(), type: 'dialogue', order: 2, character_id: 'Bob', text: '「お前の背中は俺が守る。だから迷うな」' }
              ]
            },
            {
              id: uid(),
              title: 'シーン2：ミッドポイントの罠・最大の危機',
              order: 1,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 禁断の保管庫（深夜）\n開かれた扉の奥に眠っていたのは、想像を絶する裏切りだった。' },
                { id: uid(), type: 'direction', order: 1, text: '【SE: 重厚なシャッター音と警報】' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '第3幕：クライマックスと解決',
          order: 2,
          scenes: [
            {
              id: uid(),
              title: 'シーン1：運命の最終決戦',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 天空回廊（黎明）\n激しい風が吹き荒ぶ中、因縁の対峙。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「これで終わりにする！」' }
              ]
            },
            {
              id: uid(),
              title: 'シーン2：エピローグ（新たな朝）',
              order: 1,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 丘の上（朝）\n朝陽が世界を照らす中、二人は新たな地平を見つめている。' }
              ]
            }
          ]
        }
      ]
    })
  },
  {
    id: 'kishotenketsu',
    name: '起承転結（小説・ライトノベル）',
    genre: 'Web小説・ライトノベル',
    kind: 'novel',
    badge: '小説・ラノベ',
    description: '起・承・転・結の4段構成。地の文・ルビ記法・会話文を縦書き文庫プレビューで確認しながら美しく執筆できます。',
    create: (title = '無題の物語') => ({
      format: 'axral-story',
      schema_version: 1,
      work_id: uid(),
      title,
      kind: 'novel',
      chapters: [
        {
          id: uid(),
          title: '第一章：起（日常と予兆）',
          order: 0,
          scenes: [
            {
              id: uid(),
              title: '運命の歯車',
              order: 0,
              blocks: [
                { id: uid(), type: 'prose', order: 0, text: '木漏れ日が石畳を揺らしていた。いつもと変わらない穏やかな午後、少女は古びた|魔導書《グリモワール》を開く。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「……やっぱり、この文字は普通の言語じゃないわ」' },
                { id: uid(), type: 'prose', order: 2, text: 'ページをめくる指先が微かに震える。そこには、数百年前に封印されたはずの|禁術《アルカディア》の詠唱が記されていた。' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '第二章：承（事件の進展）',
          order: 1,
          scenes: [
            {
              id: uid(),
              title: '忍び寄る影',
              order: 0,
              blocks: [
                { id: uid(), type: 'prose', order: 0, text: '図書館の外には、黒衣の使者たちが包囲を敷いていた。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Bob', text: '「アリス、逃げろ！ あいつらの狙いはその書物だ！」' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '第三章：転（急展開・真実の露顕）',
          order: 2,
          scenes: [
            {
              id: uid(),
              title: '反転する真実',
              order: 0,
              blocks: [
                { id: uid(), type: 'prose', order: 0, text: '追い詰められた塔の頂で、黒衣の頭領がフードを脱ぎ捨てた。現れたその素顔に、アリスは息を呑んだ。' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「そんな……どうしてあなたが……！？」' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '第四章：結（大団円と旅立ち）',
          order: 3,
          scenes: [
            {
              id: uid(),
              title: '彼方の空へ',
              order: 0,
              blocks: [
                { id: uid(), type: 'prose', order: 0, text: '戦火は鎮まり、新たな夜明けが訪れる。彼女の手には、役目を終えた銀の鍵が光っていた。' }
              ]
            }
          ]
        }
      ]
    })
  },
  {
    id: 'murder_mystery',
    name: 'マーダーミステリー・推理分岐シナリオ',
    genre: 'マーダーミステリー・分岐ゲーム',
    kind: 'game_scenario',
    badge: 'マダミス・ADV',
    description: '事件発生、証拠品捜査、アリバイ聴取、全体議論、告発投票までを網羅した体験型推理シナリオ構造。',
    create: (title = '洋館殺人事件の夜') => ({
      format: 'axral-story',
      schema_version: 1,
      work_id: uid(),
      title,
      kind: 'game_scenario',
      chapters: [
        {
          id: uid(),
          title: 'フェーズ1：オープニング＆事件発生',
          order: 0,
          scenes: [
            {
              id: uid(),
              title: 'プロローグ：嵐の夜の晩餐会',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 館の大広間（夜20:00）\n外は激しい豪雨。時計の鐘が8回鳴り響く。' },
                { id: uid(), type: 'direction', order: 1, text: '【SE: 突然の激しい雷鳴と停電音】' },
                { id: uid(), type: 'dialogue', order: 2, character_id: 'Bob', text: '「うわっ、停電か！？ おい、誰か懐中電灯を持ってないか！」' },
                { id: uid(), type: 'direction', order: 3, text: '【SE: 陶器の割れる音、何かが倒れる鈍い音】' },
                { id: uid(), type: 'direction', order: 4, text: '灯りが戻った時、当主の遺体が暖炉の前で発見される。' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: 'フェーズ2：現場検証と証拠品カード',
          order: 1,
          scenes: [
            {
              id: uid(),
              title: '書斎と被害者の所持品調査',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '【証拠カード A: 金庫に残された破られた手紙】\n「今夜、すべての財産分配を覆す」と書かれている。' },
                { id: uid(), type: 'direction', order: 1, text: '【証拠カード B: 床に落ちた高級万年筆】\nインクの色は深緑。現場にいた人物の手元を確認せよ。' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: 'フェーズ3：アリバイ聴取と全体集中議論',
          order: 2,
          scenes: [
            {
              id: uid(),
              title: '各プレイヤーの証言照合',
              order: 0,
              blocks: [
                { id: uid(), type: 'dialogue', order: 0, character_id: 'Alice', text: '「私は20時の停電の瞬間、ワインセラーに一人でいました。ワインを取ろうとしていたんです」' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Bob', text: '「嘘だ！ ワインセラーの鍵は当主のポケットに入っていたはずだぞ！」' },
                { id: uid(), type: 'direction', order: 2, text: '【選択肢 / 追求フラグ】\n1. アリスのワインセラー入室を追及する\n2. ボブの万年筆所持を追求する' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: 'フェーズ4：投票告発・真相解明',
          order: 3,
          scenes: [
            {
              id: uid(),
              title: 'エンディング分岐と真相暴露',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 真相解明シート\n犯人は停電を利用したのではなく、停電の5分前にすでに毒を盛っていた。' }
              ]
            }
          ]
        }
      ]
    })
  },
  {
    id: 'voice_drama',
    name: '舞台劇・朗読劇・ボイスドラマ台本',
    genre: '音声ドラマ・舞台劇',
    kind: 'audio_drama',
    badge: '音声・演劇',
    description: '役名、ト書き、効果音（SE）、劇伴音楽（BGM）の演出指示に特化した台本レイアウト。マイクワークや暗転指示もスムーズに入力可能。',
    create: (title = '雨音のシンフォニー') => ({
      format: 'axral-story',
      schema_version: 1,
      work_id: uid(),
      title,
      kind: 'audio_drama',
      chapters: [
        {
          id: uid(),
          title: '配役表・オープニング',
          order: 0,
          scenes: [
            {
              id: uid(),
              title: 'プロローグ：雨のプラットホーム',
              order: 0,
              blocks: [
                { id: uid(), type: 'note', order: 0, text: '【登場人物】\n・アリス（20代・旅人）\n・ボブ（30代・駅守）\n・ナレーション' },
                { id: uid(), type: 'direction', order: 1, text: '【SE: 遠くで鳴る踏切の警報音、絶え間なく降る雨音】' },
                { id: uid(), type: 'direction', order: 2, text: '【BGM: 哀愁を帯びたアコースティックギター、フェードイン】' },
                { id: uid(), type: 'narration', order: 3, text: '「人は誰もが、どこかへ向かう途中の旅人だ。たとえ終着駅の名前を知らなくとも……」' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: '本編：邂逅と告白',
          order: 1,
          scenes: [
            {
              id: uid(),
              title: '待合室の会話',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '【SE: 引き戸がカラカラと開く音、傘の水滴を払う音】' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Bob', text: '「おや、こんな大雨の夜に珍しいお客さんだね。最終列車はとうに出ちまったよ」' },
                { id: uid(), type: 'dialogue', order: 2, character_id: 'Alice', text: '「……知っています。でも、ここに来なければならなかった」' },
                { id: uid(), type: 'direction', order: 3, text: '【BGM: 静かにストリングスが重なる】' }
              ]
            }
          ]
        },
        {
          id: uid(),
          title: 'エピローグ：夜明け',
          order: 2,
          scenes: [
            {
              id: uid(),
              title: '朝の光の中で',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '【SE: 雨が上がり、遠くで鳥がさえずる音】' },
                { id: uid(), type: 'dialogue', order: 1, character_id: 'Alice', text: '「ありがとう、駅守さん。雨は、もう上がったみたい」' },
                { id: uid(), type: 'direction', order: 2, text: '【BGM: 晴れやかなコード進行でフェードアウト】' }
              ]
            }
          ]
        }
      ]
    })
  },
  {
    id: 'blank',
    name: '白紙から作成（シンプル）',
    genre: '自由作成',
    kind: 'screenplay',
    badge: '白紙',
    description: '何もない白紙の状態から、章・シーン・ブロックを自由に組み立てて書き始めます。',
    create: (title = '無題の物語') => ({
      format: 'axral-story',
      schema_version: 1,
      work_id: uid(),
      title,
      kind: 'screenplay',
      chapters: [
        {
          id: uid(),
          title: '第1章',
          order: 0,
          scenes: [
            {
              id: uid(),
              title: 'シーン1',
              order: 0,
              blocks: [
                { id: uid(), type: 'direction', order: 0, text: '〇 場所（時間帯）' },
                { id: uid(), type: 'dialogue', order: 1, text: '「セリフを入力してください」' }
              ]
            }
          ]
        }
      ]
    })
  }
];
