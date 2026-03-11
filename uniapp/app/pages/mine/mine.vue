<template>
  <view class="container">
    <view v-if="user" class="user-card">
      <view class="greet">Hi，{{ user.nickname }}</view>
      <view class="sub">账号：{{ user.username }}</view>
    </view>

    <view v-else class="empty-card">
      <view class="empty-title">还没有登录</view>
      <view class="empty-sub">登录后可管理收藏与观影记录</view>
      <button class="login-btn" @click="goAuth">去登录 / 注册</button>
    </view>

    <view class="item">我的收藏</view>
    <view class="item">浏览记录</view>

    <button v-if="user" class="logout-btn" @click="logout">退出登录</button>
  </view>
</template>

<script>
import { getCurrentUser, logoutUser } from '@/utils/auth'

export default {
  data() {
    return {
      user: null
    }
  },
  onShow() {
    this.user = getCurrentUser()
  },
  methods: {
    goAuth() {
      uni.navigateTo({ url: '/pages/auth/auth' })
    },
    logout() {
      logoutUser()
      this.user = null
      uni.showToast({ title: '已退出登录', icon: 'none' })
    }
  }
}
</script>

<style>
.container { padding: 20rpx; }

.user-card,
.empty-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 26rpx;
}

.greet,
.empty-title {
  font-size: 34rpx;
  font-weight: bold;
}

.sub,
.empty-sub {
  color: #666;
  margin-top: 10rpx;
}

.login-btn,
.logout-btn {
  margin-top: 20rpx;
  border-radius: 12rpx;
}

.item {
  background: #fff;
  padding: 30rpx;
  margin-top: 20rpx;
  border-radius: 16rpx;
}
</style>
