// 授業の文言はすべてここに集約（内容を変えるときはこのファイルだけ編集する）

export const COMPONENTS = [
  {
    key: 'agon',
    short: '競う',
    plain: '競って上を目指す',
    hint: '投票・ランキング・順位・集めた数',
    theory: 'アゴン',
    theorySub: '競争',
    color: 'var(--color-agon)',
  },
  {
    key: 'alea',
    short: 'ドキドキ',
    plain: '運や抽選のドキドキ',
    hint: 'ランダムグッズ・チケット抽選・ガチャ',
    theory: 'アレア',
    theorySub: '偶然',
    color: 'var(--color-alea)',
  },
  {
    key: 'mimicry',
    short: 'なりきる',
    plain: 'なりきる・重ねあわせる',
    hint: '推しカラー・コスプレ・感情移入',
    theory: 'ミミクリ',
    theorySub: '模擬',
    color: 'var(--color-mimicry)',
  },
  {
    key: 'ilinx',
    short: '熱狂',
    plain: '我を忘れる熱狂',
    hint: 'ライブの一体感・叫ぶ・没入',
    theory: 'イリンクス',
    theorySub: 'めまい',
    color: 'var(--color-ilinx)',
  },
] as const

export type ComponentKey = (typeof COMPONENTS)[number]['key']

export const CONDITIONS = [
  { key: 'free', plain: 'やめたい時に、いつでもやめられる', theory: '自由な活動' },
  { key: 'separate', plain: '日常とは切り離された、特別な時間や場所がある', theory: '隔離された活動' },
  { key: 'uncertain', plain: 'どうなるか分からないワクワクがある', theory: '未確定の活動' },
  { key: 'unproductive', plain: 'お金や成果など、何かを得るためにやっているのではない', theory: '非生産的な活動' },
  { key: 'rules', plain: '決まりごとや「お作法」がある', theory: '規則のある活動' },
  { key: 'fiction', plain: '現実とは別の世界に入っている感覚がある', theory: '虚構の活動' },
] as const

export type ConditionKey = (typeof CONDITIONS)[number]['key']

export const TOTAL_POINTS = 10

export const TITLE = '遊びの成分分析'
export const QUESTION = '推し活は、遊びですか？'
