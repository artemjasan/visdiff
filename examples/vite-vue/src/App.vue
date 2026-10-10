<script setup lang="ts">
import { ref } from 'vue'

const completed = ref(7)
const total = 10
</script>

<template>
  <main class="page">
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark">v</span>northstar</a>
      <nav aria-label="Main navigation">
        <a href="#projects">Projects</a>
        <a href="#team">Team</a>
        <button class="nav-button">Share workspace</button>
      </nav>
    </header>

    <section class="hero">
      <div>
        <p class="eyebrow">YOUR TEAM, IN A GOOD PLACE</p>
        <h1>Make progress<br /><span>feel visible.</span></h1>
        <p class="lede">A thoughtful home for the work your team is proud to put into the world.</p>
        <button class="primary-button" @click="completed = Math.min(total, completed + 1)">
          Complete a milestone <span aria-hidden="true">→</span>
        </button>
      </div>

      <article class="project-card">
        <div class="card-topline"><span class="status-dot" /> PROJECT / 04 <span class="card-date">UPDATED TODAY</span></div>
        <h2>Summer collection</h2>
        <p class="card-copy">A little more room for the details that make it yours.</p>
        <div class="progress-label"><span>Milestones</span><strong>{{ completed }} / {{ total }}</strong></div>
        <div class="progress-track"><span :style="{ width: `${completed / total * 100}%` }" /></div>
        <div class="card-footer"><span>Design system refresh</span><span>Due Nov 08</span></div>
      </article>
    </section>

    <section class="features" id="projects">
      <article><span class="feature-number">01</span><strong>Clarity for the next step</strong><p>Know what matters, without adding noise.</p></article>
      <article><span class="feature-number">02</span><strong>Space for good ideas</strong><p>Give thoughtful work room to grow.</p></article>
      <article><span class="feature-number">03</span><strong>Momentum that lasts</strong><p>Make progress feel like progress.</p></article>
    </section>
  </main>
</template>
