import { createServerFn } from '@tanstack/react-start'
import { bibleVersion, chapterInput, fetchBibleBooks, fetchBibleChapter } from './bibleProvider'

// Fixed-origin server requests: no credentials or upstream HTML enter the UI.
export const getBibleBooks = createServerFn({ method: 'GET' })
  .validator((input: { version: string }) => ({ version: bibleVersion(input.version).id }))
  .handler(async ({ data }) => {
    try { return { books: await fetchBibleBooks(data.version), error: null } }
    catch { return { books: [], error: 'Bible books are temporarily unavailable. Please try again.' } }
  })
export const getBibleChapter = createServerFn({ method: 'GET' })
  .validator(chapterInput)
  .handler(async ({ data }) => {
    try { return { passage: await fetchBibleChapter(data), error: null } }
    catch { return { passage: null, error: 'This chapter could not be loaded. Try again or choose another translation.' } }
  })
