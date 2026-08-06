export type BoardTask = { id: string; title: string; course: string; minutes: number; done: boolean }

const tasks: BoardTask[] = [
  { id: '1', title: 'Review spaced repetition notes', course: 'Cognitive science', minutes: 18, done: true },
  { id: '2', title: 'Build a typed loader boundary', course: 'TanStack Start', minutes: 35, done: false },
  { id: '3', title: 'Write the first learning reflection', course: 'Personal practice', minutes: 12, done: false },
  { id: '4', title: 'Read one chapter of Design Systems', course: 'Product craft', minutes: 25, done: false },
]

export async function getBoardSnapshot(view: 'today' | 'week') {
  const visibleTasks = view === 'week' ? [...tasks, { id: '5', title: 'Plan next week’s deep-work block', course: 'Planning', minutes: 20, done: false }] : tasks
  return {
    tasks: visibleTasks,
    completed: visibleTasks.filter((task) => task.done).length,
    totalMinutes: visibleTasks.reduce((sum, task) => sum + task.minutes, 0),
    streak: 7,
    dateLabel: new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date()),
  }
}

export type ActivityChunk = { time: string; text: string }

export async function* getActivityStream(): AsyncGenerator<ActivityChunk> {
  const items: ActivityChunk[] = [
    { time: '08:42', text: 'Completed a review session on cognitive science' },
    { time: '09:15', text: 'Added “typed loader boundary” to today’s board' },
    { time: '10:03', text: 'Reached a 7-day learning streak' },
  ]
  for (const item of items) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    yield item
  }
}
