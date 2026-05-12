export const BUSINESS_LABELS: Record<number, string> = {
  1: '情报',
  2: '游戏',
  3: '图包',
  4: '书库',
};

export const ARTICLE_THEME_LABELS: Record<number, string> = {
  1: '新番情报',
  2: '二游动态',
  3: '圈内杂谈',
  4: '业界观察',
};

export const IMAGE_THEME_LABELS: Record<number, string> = {
  1: '壁纸图包',
  2: '插画图集',
  3: '剧情CG',
  4: '收藏图集',
};

export const BOOK_PART_LABELS: Record<number, string> = {
  1: '漫画',
  2: '小说',
  3: '资料',
};

export const BOOK_AREA_LABELS: Record<number, string> = {
  1: '日系',
  2: '国创',
  3: '其他',
};

export const BOOK_STYLE_LABELS: Record<number, string> = {
  101: '校园',
  102: '奇幻',
  103: '冒险',
  104: '都市',
  105: '恋爱',
  106: '悬疑',
  107: '科幻',
  108: '治愈',
  109: '历史',
  110: '喜剧',
};

export const BOOK_STYLE_IDS = Object.keys(BOOK_STYLE_LABELS).map((key) => Number(key));

export const TOPIC_LABELS: Record<number, string> = {
  1: 'Galgame',
  2: 'RPG游戏',
  3: 'SLG游戏',
  4: 'ACT游戏',
  5: '养成模拟',
  6: '综合分区',
};

export const TOPIC_TYPE_LABELS: Record<number, string> = {
  1: '作品浏览',
  2: '资源下载',
  3: '版本更新',
  4: '合集整理',
};

export const TOPIC_FEATURE_FLAG_LABELS: Record<number, string> = {
  1: '汉化',
  2: '官中',
  3: 'PC',
  4: '安卓',
  5: '新作',
  6: '经典',
  7: '同人',
};

export const TOPIC_FEATURE_FLAG_IDS = Object.keys(TOPIC_FEATURE_FLAG_LABELS).map((key) => Number(key));
