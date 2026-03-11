<template>
  <view class="container">

    <image
      class="poster"
      :src="imgUrl + movie.poster_path"
      mode="aspectFill"
    />

    <view class="title">
      {{ movie.chinese_name }}
    </view>

    <view class="info">
      ⭐评分：{{ movie.vote_average }}
    </view>

    <view class="info">
      📅上映时间：{{ movie.release_date.substring(0,10) }}
    </view>

    <view class="info">
      简介：
    </view>

    <view class="story">
      {{ movie.chinese_overview }}
    </view>

  </view>
</template>

<script>
export default {

  data() {
    return {
      movie: {},
      imgUrl:"https://image.tmdb.org/t/p/w500"
    }
  },

  onLoad(options) {
    this.getDetail(options.id)
  },

  methods: {

    getDetail(id) {

      uni.request({
        url: "http://localhost:3000/api/movie",
        data: { id },

        success: (res) => {

          if (res.data.code === 200) {
            this.movie = res.data.data
          }

        }
      })

    }

  }
}
</script>

<style>
.container{
  padding:20rpx;
}

.poster{
  width:100%;
  height:600rpx;
  border-radius:10rpx;
}

.title{
  font-size:40rpx;
  font-weight:bold;
  margin-top:20rpx;
}

.info{
  margin-top:20rpx;
}

.story{
  margin-top:20rpx;
  color:#666;
}
</style>