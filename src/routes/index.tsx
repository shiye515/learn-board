import { createFileRoute } from '@tanstack/react-router'
import { WhiteboardWorkspace } from '../components/whiteboard/WhiteboardWorkspace'

export const Route = createFileRoute('/')({
  ssr: true,
  component: WhiteboardWorkspace,
})
