<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import TaskPreview from './TaskPreview.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-image>
      <TaskPreview />
    </template>
  </Layout>
</template>
