import type { FeedbackEvent, Post, Work } from './types'

export const initialProfile = { nickname: '我', avatarLabel: '我' }

export const initialWorks: Work[] = [
  { id: 'w1', title: '下雨天的老街散步', platform: '小红书', publishedAt: '2026-08-24', cover: '雨巷', plays: 12800, likes: 863, comments: 76, favorites: 149, shares: 28, note: '拍完这条，忽然觉得慢下来也挺好。', mood: '平静' },
  { id: 'w2', title: '一人食的第 100 天', platform: '抖音', publishedAt: '2026-08-18', cover: '厨房', plays: 35600, likes: 2189, comments: 204, favorites: 327, shares: 91, note: '第一次有人说想照着我的菜单做。', mood: '骄傲' },
  { id: 'w3', title: '八月的工作台', platform: '视频号', publishedAt: '2026-08-10', cover: '桌面', plays: 9200, likes: 411, comments: 38, favorites: 62, shares: 15, note: '镜头前的杂乱，居然很像最近的自己。', mood: '疲惫' },
]

export const initialFeedback: FeedbackEvent[] = [
  { id: 'f1', workId: 'w2', type: '暖心评论', content: '“看完突然想给自己做顿饭。”', createdAt: '2026-08-19' },
  { id: 'f2', workId: 'w1', type: '点赞突破', content: '这条作品第一次被收藏超过 100 次。', createdAt: '2026-08-25' },
]

export const initialPosts: Post[] = [
  { id: 'p1', author: '西西的放映室', avatar: '西', content: '最近决定不追每一条的数据了。把评论区里真正打动我的话，认真存下来。', createdAt: '2小时前', likes: 128, liked: false, comments: ['这个习惯真好', '我也准备试试'] },
  { id: 'p2', author: '阿桃在记录', avatar: '桃', content: '今天终于发出了拖了两周的视频。它也许不会爆，但它是完整的。', image: '窗边', createdAt: '昨天', likes: 236, liked: false, comments: ['完整比完美重要', '恭喜发出！'] },
]
