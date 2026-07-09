<template>
  <view class="shelf-page">
    <view class="shelf-header">
      <view class="header-left">
        <text class="title">书架</text>
        <text class="book-count">{{ books.length }}本书</text>
      </view>
      <view class="header-right">
        <view class="search-btn" @click="handleSearch">
          <text class="iconfont">🔍</text>
        </view>
        <view class="add-btn" @click="handleAdd">
          <text class="iconfont">+</text>
        </view>
      </view>
    </view>

    <view class="shelf-tabs">
      <view 
        v-for="tab in tabs" 
        :key="tab.key"
        :class="['tab-item', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <text>{{ tab.label }}</text>
        <view v-if="activeTab === tab.key" class="tab-indicator"></view>
      </view>
    </view>

    <scroll-view 
      class="shelf-content" 
      scroll-y 
      :style="{ height: scrollHeight + 'px' }"
    >
      <view v-if="books.length === 0" class="empty-state">
        <view class="empty-icon">📚</view>
        <text class="empty-text">书架还是空的</text>
        <text class="empty-hint">点击右上角添加书籍</text>
      </view>

      <view v-else class="book-grid">
        <view 
          v-for="book in filteredBooks" 
          :key="book.id" 
          class="book-item"
          @click="handleBookClick(book)"
          @longpress="handleLongPress(book)"
        >
          <view class="book-cover-wrapper">
            <image 
              class="book-cover" 
              :src="book.coverUrl" 
              mode="aspectFill"
              lazy-load
            />
            <view v-if="book.progress > 0" class="progress-ring">
              <text class="progress-text">{{ book.progress }}%</text>
            </view>
          </view>
          <text class="book-title ellipsis">{{ book.title }}</text>
          <text class="book-author text-secondary ellipsis">{{ book.author }}</text>
          <view v-if="book.progress > 0" class="book-progress">
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: book.progress + '%' }"></view>
            </view>
          </view>
          <view v-if="book.lastReadTime" class="last-read">
            <text class="text-tertiary">{{ formatTime(book.lastReadTime) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="showMenu" class="action-menu">
      <view class="menu-item" @click="handleAddBook">
        <text class="menu-icon">📥</text>
        <text>导入书籍</text>
      </view>
      <view class="menu-item" @click="handleManage">
        <text class="menu-icon">✏️</text>
        <text>管理书架</text>
      </view>
      <view class="menu-item cancel" @click="showMenu = false">
        <text>取消</text>
      </view>
    </view>

    <view v-if="showManage" class="manage-overlay">
      <view class="manage-header">
        <text>管理书架</text>
        <view class="manage-actions">
          <view class="manage-btn" @click="selectAll">
            <text>{{ isAllSelected ? '取消全选' : '全选' }}</text>
          </view>
          <view class="manage-btn delete" @click="deleteSelected">
            <text>删除</text>
          </view>
        </view>
      </view>
      <scroll-view class="manage-list" scroll-y>
        <view 
          v-for="book in books" 
          :key="book.id" 
          class="manage-item"
        >
          <view 
            :class="['checkbox', { checked: selectedBooks.includes(book.id) }]"
            @click="toggleSelect(book.id)"
          >
            <text v-if="selectedBooks.includes(book.id)">✓</text>
          </view>
          <image class="manage-cover" :src="book.coverUrl" mode="aspectFill" />
          <view class="manage-info">
            <text class="manage-title">{{ book.title }}</text>
            <text class="manage-author">{{ book.author }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="manage-footer">
        <view class="cancel-btn" @click="showManage = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBookStore } from '@/stores/book'
import { ebookApi } from '@/utils/api'
import type { Book } from '@/types'

const store = useBookStore()
const books = ref<Book[]>([])
const activeTab = ref('all')
const showMenu = ref(false)
const showManage = ref(false)
const selectedBooks = ref<string[]>([])
const scrollHeight = ref(0)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'reading', label: '在读' },
  { key: 'finished', label: '已读完' },
  { key: 'purchased', label: '已购买' }
]

const filteredBooks = computed(() => {
  switch (activeTab.value) {
    case 'reading':
      return books.value.filter(b => b.progress > 0 && b.progress < 100)
    case 'finished':
      return books.value.filter(b => b.progress >= 100)
    case 'purchased':
      return books.value
    default:
      return books.value
  }
})

const isAllSelected = computed(() => {
  return selectedBooks.value.length === books.value.length && books.value.length > 0
})

onMounted(() => {
  loadBooks()
  calculateScrollHeight()
  store.loadSettings()
  
  uni.getSystemInfo({
    success: (res) => {
      scrollHeight.value = res.windowHeight - 200
    }
  })
})

async function loadBooks() {
  try {
    uni.showLoading({ title: '加载中...' })
    const data = await ebookApi.getBookshelf()
    books.value = data
    store.setBooks(data)
  } catch (err) {
    console.error('加载书架失败', err)
    books.value = mockBooks
  } finally {
    uni.hideLoading()
  }
}

function calculateScrollHeight() {
  const query = uni.createSelectorQuery()
  query.select('.shelf-content').boundingClientRect((rect) => {
    if (rect) {
      scrollHeight.value = rect.height
    }
  }).exec()
}

function handleBookClick(book: Book) {
  store.setCurrentBook(book.id)
  uni.navigateTo({
    url: `/pages/reader/index?bookId=${book.id}`
  })
}

function handleLongPress(book: Book) {
  showMenu.value = true
}

function handleSearch() {
  uni.showToast({ title: '搜索功能开发中', icon: 'none' })
}

function handleAdd() {
  showMenu.value = !showMenu.value
}

function handleAddBook() {
  showMenu.value = false
  uni.showToast({ title: '导入功能开发中', icon: 'none' })
}

function handleManage() {
  showMenu.value = false
  showManage.value = true
}

function toggleSelect(bookId: string) {
  const index = selectedBooks.value.indexOf(bookId)
  if (index >= 0) {
    selectedBooks.value.splice(index, 1)
  } else {
    selectedBooks.value.push(bookId)
  }
}

function selectAll() {
  if (isAllSelected.value) {
    selectedBooks.value = []
  } else {
    selectedBooks.value = books.value.map(b => b.id)
  }
}

function deleteSelected() {
  if (selectedBooks.value.length === 0) {
    uni.showToast({ title: '请选择要删除的书籍', icon: 'none' })
    return
  }
  
  uni.showModal({
    title: '确认删除',
    content: `确定删除选中的 ${selectedBooks.value.length} 本书吗？`,
    success: (res) => {
      if (res.confirm) {
        books.value = books.value.filter(b => !selectedBooks.value.includes(b.id))
        selectedBooks.value = []
        store.setBooks(books.value)
        uni.showToast({ title: '删除成功', icon: 'success' })
      }
    }
  })
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const mockBooks: Book[] = [
  {
    id: '1',
    title: '三体',
    author: '刘慈欣',
    coverUrl: 'https://neeko-copilot.bytedance.net/api/text_to_image?prompt=science%20fiction%20book%20cover%20space%20universe&image_size=square',
    progress: 68,
    lastReadTime: Date.now() - 86400000