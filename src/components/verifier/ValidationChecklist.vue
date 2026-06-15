<template>
  <div class="checklist">
    <div class="checklist-head">
      <h4 class="checklist-title">
        <span class="material-symbols-outlined" aria-hidden="true">checklist</span>
        Validation Checklist
      </h4>
      <span class="progress-pill" :class="{ complete: progress.done === progress.total }">
        {{ progress.done }}/{{ progress.total }} required
      </span>
    </div>

    <div v-if="loading" class="checklist-state">Loading checklist…</div>

    <template v-else>
      <div v-for="section in sections" :key="section.section" class="checklist-section">
        <h5 class="section-title">{{ section.section }}</h5>
        <div v-for="item in section.items" :key="item.key" class="check-item">
          <label class="check-label">
            <input type="checkbox" :checked="isChecked(item.key)" @change="toggle(item.key, $event)" />
            <span>
              {{ item.label }}
              <span v-if="item.required" class="req">required</span>
            </span>
          </label>
          <input
            class="note-input"
            type="text"
            placeholder="Note (optional)"
            :value="noteFor(item.key)"
            @input="setNote(item.key, $event)"
          />
        </div>
      </div>

      <div class="checklist-actions">
        <button class="save-btn" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save checklist' }}
        </button>
        <span v-if="msg" class="msg" :class="msg.type">{{ msg.text }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { CHECKLIST_SECTIONS, requiredProgress } from '@/constants/verificationChecklist'
import { getAssessment, saveAssessment } from '@/services/verificationService'

const props = defineProps({
  projectId: { type: String, required: true },
})

const sections = CHECKLIST_SECTIONS
const checklist = ref({})
const loading = ref(true)
const saving = ref(false)
const msg = ref(null)

const progress = computed(() => requiredProgress(checklist.value))

function isChecked(key) {
  return checklist.value?.[key]?.checked === true
}
function noteFor(key) {
  return checklist.value?.[key]?.note || ''
}
function ensure(key) {
  if (!checklist.value[key]) checklist.value[key] = { checked: false, note: '' }
}
function toggle(key, e) {
  ensure(key)
  checklist.value[key].checked = e.target.checked
}
function setNote(key, e) {
  ensure(key)
  checklist.value[key].note = e.target.value
}

async function load() {
  loading.value = true
  msg.value = null
  checklist.value = await getAssessment(props.projectId)
  loading.value = false
}

async function save() {
  saving.value = true
  msg.value = null
  try {
    await saveAssessment(props.projectId, checklist.value)
    msg.value = { type: 'ok', text: 'Checklist saved.' }
  } catch (err) {
    msg.value = { type: 'error', text: err.message }
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => props.projectId, load)
</script>

<style scoped>
.checklist {
  margin-top: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1rem;
  background: #fcfcfd;
}
.checklist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.checklist-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.95rem;
}
.progress-pill {
  font-size: 0.72rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}
.progress-pill.complete {
  background: #ecfdf5;
  color: #047857;
}
.checklist-state {
  color: #9ca3af;
  font-size: 0.85rem;
}
.checklist-section {
  margin-bottom: 0.9rem;
}
.section-title {
  margin: 0 0 0.4rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6b7280;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0;
  flex-wrap: wrap;
}
.check-label {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  flex: 1;
  min-width: 220px;
  cursor: pointer;
}
.req {
  font-size: 0.65rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border-radius: 999px;
  padding: 0.02rem 0.4rem;
  margin-left: 0.3rem;
  vertical-align: middle;
}
.note-input {
  flex: 1;
  min-width: 160px;
  padding: 0.35rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  font-size: 0.8rem;
}
.checklist-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.save-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: #069e2d;
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.msg {
  font-size: 0.8rem;
}
.msg.ok {
  color: #047857;
}
.msg.error {
  color: #dc2626;
}
</style>
