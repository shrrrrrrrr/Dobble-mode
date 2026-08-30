/**
 * Short-cycle recap copy. Edit the strings below to design the narration;
 * keep the data calculation in WeeklyRecap unchanged.
 */
export const recapCopy = {
  opening: { eyebrow: '本周创作回看', title: '这七天，\n你没有白过。', suffix: '条作品被认真留了下来。' },
  favorite: { eyebrow: '被更多人看见', suffix: '个喜欢，是这周最明亮的回应。' },
  media: { eyebrow: '留住画面', title: '这些片段，\n也一起留了下来。', suffix: '不是首尾帧，而是从作品里挑出的几个瞬间。' },
  note: { eyebrow: '你当时写下', suffix: '不止数据，你也记住了那个时刻的自己。' },
  feedback: { eyebrow: '收下这些声音', suffix: '下一周，也继续为自己留下一个时刻。' },
  empty: { eyebrow: '本周创作回看', title: '最近七天，\n还没有作品记录。', body: '下一次记录作品时，这里会帮你收起当时的感受、数据和回应。' },
} as const
