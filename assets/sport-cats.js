/* ============================================================
 * sport-cats.js — 运动类型分类常量
 * ========================================================== */
(function (global) {
  'use strict';

  const SPORT_TYPES = ['跑步', '健身', '骑行', '游泳', '瑜伽', '步行', '球类', '其他'];

  const SPORT_CATEGORIES = {
    aerobic:  { key: 'aerobic',  icon: '🏃', label: '有氧运动' },
    strength: { key: 'strength', icon: '💪', label: '力量训练' },
    core:     { key: 'core',     icon: '🔥', label: '核心训练' },
    duration: { key: 'duration', icon: '🧘', label: '柔韧放松' },
    ball:     { key: 'ball',     icon: '⚽', label: '球类运动' },
    other:    { key: 'other',    icon: '📌', label: '其他' },
  };
  const SPORT_CAT_KEYS = ['aerobic', 'strength', 'core', 'duration', 'ball', 'other'];
  const SPORT_CAT_NAMES = {
    aerobic:  ['跑步','步行','骑行','游泳','开合跳','跳绳','椭圆机','爬楼梯','动感单车'],
    strength: ['俯卧撑','深蹲','引体向上','杠铃','哑铃','卧推','硬拉','推举','划船','弯举','臂屈伸','推胸','拉背','举腿'],
    core:     ['卷腹','死虫式','平板支撑','俄罗斯转体','登山跑','仰卧起坐','仰卧抬腿','侧平板','臀桥','高抬腿','平板'],
    duration: ['瑜伽','冥想','拉伸','泡沫轴','普拉提','八段锦','太极拳'],
    ball:     ['篮球','足球','羽毛球','乒乓球','网球','排球','棒球','高尔夫'],
  };

  const SPORT_EMOJI_MAP = {
    '跑步': '🏃', '步行': '🚶', '骑行': '🚴', '游泳': '🏊',
    '瑜伽': '🧘', '开合跳': '🤸', '跳绳': '🪢', '椭圆机': '🏋️',
    '爬楼梯': '🪜', '动感单车': '🚴',
    '俯卧撑': '💪', '深蹲': '🦵', '引体向上': '💪',
    '卷腹': '🧎', '杠铃': '🏋️', '哑铃': '🏋️', '卧推': '🏋️',
    '硬拉': '🏋️', '推举': '🏋️',
    '平板支撑': '🧘', '冥想': '🧘', '拉伸': '🧘', '泡沫轴': '🧘',
    '篮球': '🏀', '足球': '⚽', '羽毛球': '🏸', '乒乓球': '🏓',
    '网球': '🎾', '排球': '🏐',
    '死虫式': '🐛', '登山跑': '🏔️', '俄罗斯转体': '🌀',
    '仰卧起坐': '🧎', '臀桥': '🍑', '高抬腿': '🏃', '侧平板': '🧘', '平板': '🧘',
  };

  function classifySport(name) {
    const n = (name || '').trim();
    for (const key of SPORT_CAT_KEYS) {
      if (key === 'other') return SPORT_CATEGORIES.other;
      if (SPORT_CAT_NAMES[key].some((k) => n.includes(k))) return SPORT_CATEGORIES[key];
    }
    return SPORT_CATEGORIES.other;
  }

  global.SPORT_TYPES = SPORT_TYPES;
  global.SPORT_CATEGORIES = SPORT_CATEGORIES;
  global.SPORT_CAT_KEYS = SPORT_CAT_KEYS;
  global.SPORT_CAT_NAMES = SPORT_CAT_NAMES;
  global.SPORT_EMOJI_MAP = SPORT_EMOJI_MAP;
  global.classifySport = classifySport;
})(window);
