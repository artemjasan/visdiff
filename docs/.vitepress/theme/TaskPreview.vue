<script setup lang="ts">
import { ref } from 'vue'

const taskJson = `{
  "id": "vdt_a81k2m",
  "receivedAt": "2026-10-07T12:30:00.000Z",
  "url": "http://localhost:5173/pricing",
  "viewport": { "width": 1280, "height": 800 },
  "note": "Bring the plan cards closer together.",
  "changes": [
    {
      "element": {
        "tag": "section",
        "selector": "main > section.plans",
        "text": "Starter · Team · Scale",
        "source": {
          "file": "src/pages/Pricing.tsx",
          "line": 42,
          "column": 5
        }
      },
      "edits": [
        { "property": "gap", "from": "32px", "to": "20px", "kind": "style" }
      ]
    }
  ]
}`

const copied = ref(false)
const copyError = ref(false)

async function copyTask(): Promise<void> {
  copied.value = false
  copyError.value = false
  try {
    await navigator.clipboard.writeText(taskJson)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copyError.value = true
  }
}
</script>

<template>
  <section class="task-preview" aria-label="Example Visdiff task">
    <header class="task-preview__header">
      <div>
        <span class="task-preview__eyebrow">TASK PAYLOAD</span>
        <span class="task-preview__file">.visdiff/tasks.json</span>
      </div>
      <button class="task-preview__copy" type="button" @click="copyTask">
        {{ copied ? 'Copied' : 'Copy JSON' }}
      </button>
    </header>
    <pre class="task-preview__code"><code>{{ taskJson }}</code></pre>
    <p class="task-preview__status" aria-live="polite">
      <template v-if="copyError">Clipboard unavailable. Select and copy the JSON.</template>
      <template v-else>Intent + source + observed change</template>
    </p>
  </section>
</template>
