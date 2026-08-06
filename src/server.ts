import { createServerEntry } from '@tanstack/react-start/server-entry'
import {
  createStartHandler,
  defaultStreamHandler,
  defineHandlerCallback,
} from '@tanstack/react-start/server'

const handler = defineHandlerCallback((ctx) => defaultStreamHandler(ctx))
const fetch = createStartHandler(handler)

export default createServerEntry({ fetch })
