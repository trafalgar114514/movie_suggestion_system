<template>
  <view class="container">

    <view class="search" @click="goSearch">
      🔍 搜索电影
    </view>

    <view v-for="item in movies"
          :key="item.id"
          class="card"
          @click="goDetail(item.id)">

      <image
        class="poster"
        :src="imgUrl + item.poster_path"
        mode="aspectFill"
      />

      <view class="right">

        <view class="title">
          {{ item.chinese_name }}
        </view>

        <view class="info">
          ⭐评分：{{ item.vote_average }}
        </view>

        <view class="info">
          📅上映：{{ item.release_date.substring(0,10) }}
        </view>

      </view>

    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      movies: [],
      imgUrl: "https://image.tmdb.org/t/p/w500"
    }
  },

  onLoad() {
    this.getMovies()
  },

  methods: {

    getMovies() {
      uni.request({
        url: "http://localhost:3000/api/movies",
        success: (res) => {
          if (res.data.code === 200) {
            this.movies = res.data.data
          }
        }
      })
    },

    goSearch() {
      uni.navigateTo({
        url: "/pages/search/search"
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
.container { padding: 20rpx; }

.search{
  background:#eee;
  padding:20rpx;
  border-radius:20rpx;
}

.card{
  display:flex;
  background:#fff;
  margin-top:20rpx;
  padding:20rpx;
  border-radius:12rpx;
}

.poster{
  width:160rpx;
  height:220rpx;
  border-radius:10rpx;
}

.right{
  margin-left:20rpx;
}

.title{
  font-size:32rpx;
  font-weight:bold;
}

.info{
  margin-top:10rpx;
  color:#666;
}
</style>