<template>
  <view class="container">

    <input
      v-model="keyword"
      placeholder="输入电影名"
      class="input"
    />

    <button @click="search">搜索</button>

    <view v-for="item in list"
          :key="item.id"
          class="item"
          @click="goDetail(item.id)">

      {{ item.chinese_name }}

    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      keyword: '',
      list: []
    }
  },

  methods: {

    search() {

      uni.request({
        url: "http://localhost:3000/api/search",
        data: {
          keyword: this.keyword
        },
        success: (res) => {
          if (res.data.code === 200) {
            this.list = res.data.data
          }
        }
      })

    },

    goDetail(id) {
      uni.navigateTo({
        url: "/pages/detail/detail?id=" + id
      })
    }

  }
}
</script>

<style>
.container{
  padding:20rpx;
}

.input{
  border:1px solid #ddd;
  padding:20rpx;
  margin-bottom:20rpx;
}

.item{
  padding:20rpx;
  border-bottom:1px solid #eee;
}
</style>