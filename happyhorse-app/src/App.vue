<template>
  <div class="app">
    <nav class="top-nav">
      <router-link to="/" class="nav-link" active-class="active" exact>
        🎬 视频生成
      </router-link>
      <router-link to="/files" class="nav-link" active-class="active">
        📂 文件浏览
      </router-link>
    </nav>

    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0d0d0d;
  color: #f0f0f0;
  min-height: 100vh;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.top-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: #1a1a1a;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid #3a3a3a;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.nav-link {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  text-align: center;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #ddd;
}

.nav-link.active {
  background: #3a3a3a;
  color: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
</style>
