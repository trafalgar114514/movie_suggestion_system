const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const crypto = require('crypto')

const app = express()
app.use(cors())
app.use(express.json())

const HASH_ITERATIONS = 120000
const HASH_KEY_LENGTH = 64
const HASH_DIGEST = 'sha512'

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex')
}

// 数据库连接
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '123123lzy',
  database: 'movie_db'
})

function initUserTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      nickname VARCHAR(50) NOT NULL,
      password_hash VARCHAR(128) NOT NULL,
      password_salt VARCHAR(32) NOT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  db.query(sql, (err) => {
    if (err) {
      console.log('初始化用户表失败:', err)
    }
  })
}

function initMovieExtensionSchema() {
  const addGenresSql = `
    ALTER TABLE movies
    ADD COLUMN genres JSON NULL
  `

  db.query(addGenresSql, (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.log('初始化电影类型字段失败:', err)
    }
  })

  const createBehaviorSql = `
    CREATE TABLE IF NOT EXISTS user_movie_behaviors (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL,
      movie_id INT NOT NULL,
      behavior_type ENUM('view', 'like', 'favorite') NOT NULL,
      score DECIMAL(5,2) NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      INDEX idx_user_movie (username, movie_id),
      INDEX idx_movie (movie_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  db.query(createBehaviorSql, (err) => {
    if (err) {
      console.log('初始化用户行为表失败:', err)
    }
  })
}

// 连接数据库
db.connect((err) => {
  if (err) {
    console.log('数据库连接失败:', err)
  } else {
    console.log('数据库连接成功')
    initUserTable()
    initMovieExtensionSchema()
  }
})

function toScoreMap(rows) {
  const scoreMap = new Map()
  rows.forEach((item) => {
    scoreMap.set(item.movie_id, Number(item.total_score) || 0)
  })
  return scoreMap
}

function cosineSimilarityByMap(leftMap, rightMap) {
  let dotProduct = 0
  let leftNorm = 0
  let rightNorm = 0

  leftMap.forEach((value, key) => {
    leftNorm += value * value
    if (rightMap.has(key)) {
      dotProduct += value * rightMap.get(key)
    }
  })

  rightMap.forEach((value) => {
    rightNorm += value * value
  })

  if (!leftNorm || !rightNorm) {
    return 0
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

function calculateItemCfScores(candidateMovieIds, userScoreMap, behaviorRows) {
  const userMovieIds = new Set(userScoreMap.keys())
  const usersByMovie = new Map()
  const movieScoresByUser = new Map()

  behaviorRows.forEach((row) => {
    if (!usersByMovie.has(row.movie_id)) {
      usersByMovie.set(row.movie_id, new Map())
    }
    usersByMovie.get(row.movie_id).set(row.username, Number(row.total_score) || 0)

    if (!movieScoresByUser.has(row.username)) {
      movieScoresByUser.set(row.username, new Map())
    }
    movieScoresByUser.get(row.username).set(row.movie_id, Number(row.total_score) || 0)
  })

  const scores = new Map()

  candidateMovieIds.forEach((candidateId) => {
    const candidateUserMap = usersByMovie.get(candidateId)
    if (!candidateUserMap) {
      scores.set(candidateId, 0)
      return
    }

    let weightedScore = 0
    let weightSum = 0

    userMovieIds.forEach((seenMovieId) => {
      const seenUserMap = usersByMovie.get(seenMovieId)
      if (!seenUserMap) {
        return
      }

      const similarity = cosineSimilarityByMap(candidateUserMap, seenUserMap)
      if (similarity <= 0) {
        return
      }

      const userScore = userScoreMap.get(seenMovieId) || 0
      weightedScore += similarity * userScore
      weightSum += Math.abs(similarity)
    })

    scores.set(candidateId, weightSum > 0 ? weightedScore / weightSum : 0)
  })

  return { scores, movieScoresByUser }
}

function calculateUserCfScores(candidateMovieIds, username, userScoreMap, movieScoresByUser) {
  const similarUsers = []

  movieScoresByUser.forEach((profile, otherUser) => {
    if (otherUser === username) {
      return
    }

    const similarity = cosineSimilarityByMap(userScoreMap, profile)
    if (similarity > 0) {
      similarUsers.push({ similarity, profile })
    }
  })

  similarUsers.sort((a, b) => b.similarity - a.similarity)
  const topUsers = similarUsers.slice(0, 5)
  const scores = new Map()

  candidateMovieIds.forEach((candidateId) => {
    let weightedScore = 0
    let weightSum = 0

    topUsers.forEach((user) => {
      const candidateScore = user.profile.get(candidateId)
      if (candidateScore === undefined) {
        return
      }

      weightedScore += user.similarity * candidateScore
      weightSum += Math.abs(user.similarity)
    })

    scores.set(candidateId, weightSum > 0 ? weightedScore / weightSum : 0)
  })

  return scores
}

// 测试接口
app.get('/api/test', (req, res) => {
  res.json({ msg: 'ok' })
})

// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, password, nickname } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请填写用户名和密码' })
    return
  }

  if (password.length < 6) {
    res.send({ code: 400, message: '密码至少6位' })
    return
  }

  const findSql = 'SELECT id FROM users WHERE username = ? LIMIT 1'
  db.query(findSql, [username], (findErr, findResult) => {
    if (findErr) {
      console.log(findErr)
      res.send({ code: 500, message: '注册失败，请稍后重试' })
      return
    }

    if (findResult.length) {
      res.send({ code: 409, message: '用户名已存在' })
      return
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = hashPassword(password, salt)

    const insertSql = `
      INSERT INTO users (username, nickname, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `

    db.query(
      insertSql,
      [username, nickname || username, passwordHash, salt, Date.now()],
      (insertErr) => {
        if (insertErr) {
          console.log(insertErr)
          res.send({ code: 500, message: '注册失败，请稍后重试' })
          return
        }

        res.send({ code: 200, message: '注册成功，请登录' })
      }
    )
  })
})

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    res.send({ code: 400, message: '请完整填写登录信息' })
    return
  }

  const sql = `
    SELECT username, nickname, password_hash, password_salt
    FROM users
    WHERE username = ?
    LIMIT 1
  `

  db.query(sql, [username], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500, message: '登录失败，请稍后重试' })
      return
    }

    const user = result[0]
    if (!user) {
      res.send({ code: 401, message: '用户名或密码错误' })
      return
    }

    const candidateHash = hashPassword(password, user.password_salt)
    if (candidateHash !== user.password_hash) {
      res.send({ code: 401, message: '用户名或密码错误' })
      return
    }

    res.send({
      code: 200,
      message: '登录成功',
      data: {
        username: user.username,
        nickname: user.nickname
      }
    })
  })
})

// =====================
// 获取首页电影（前20条）
// =====================
app.get('/api/movies', (req, res) => {
  const sql = `
        SELECT
            id,
            chinese_name,
            poster_path,
            vote_average,
            release_date,
            genres
        FROM movies
        ORDER BY popularity DESC
        LIMIT 20
    `

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result
      })
    }
  })
})

// =====================
// 搜索电影
// =====================
app.get('/api/search', (req, res) => {
  const keyword = req.query.keyword

  const sql = `
        SELECT
            id,
            chinese_name,
            poster_path,
            vote_average,
            release_date,
            genres
        FROM movies
        WHERE chinese_name LIKE ?
        LIMIT 50
    `

  db.query(sql, [`%${keyword}%`], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result
      })
    }
  })
})

// =====================
// 电影详情
// =====================
app.get('/api/movie', (req, res) => {
  const id = req.query.id

  const sql = `
        SELECT *
        FROM movies
        WHERE id = ?
    `

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.log(err)
      res.send({ code: 500 })
    } else {
      res.send({
        code: 200,
        data: result[0]
      })
    }
  })
})

// =====================
// 记录用户行为（供推荐使用）
// =====================
app.post('/api/behavior', (req, res) => {
  const { username, movie_id: movieId, behavior_type: behaviorType, score } = req.body || {}

  if (!username || !movieId || !behaviorType) {
    res.send({ code: 400, message: '缺少必要参数' })
    return
  }

  const allowedTypes = new Set(['view', 'like', 'favorite'])
  if (!allowedTypes.has(behaviorType)) {
    res.send({ code: 400, message: 'behavior_type不合法' })
    return
  }

  const safeScore = Number(score) > 0 ? Number(score) : 1
  const sql = `
    INSERT INTO user_movie_behaviors (username, movie_id, behavior_type, score, created_at)
    VALUES (?, ?, ?, ?, ?)
  `

  db.query(sql, [username, movieId, behaviorType, safeScore, Date.now()], (err) => {
    if (err) {
      console.log(err)
      res.send({ code: 500, message: '记录行为失败' })
      return
    }

    res.send({ code: 200, message: 'ok' })
  })
})

// =====================
// 推荐接口（主：ItemCF；辅：UserCF）
// =====================
app.get('/api/recommend', (req, res) => {
  const username = req.query.username
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 20

  if (!username) {
    res.send({ code: 400, message: '请提供username' })
    return
  }

  const userBehaviorSql = `
    SELECT movie_id, SUM(score) AS total_score
    FROM user_movie_behaviors
    WHERE username = ?
    GROUP BY movie_id
  `

  db.query(userBehaviorSql, [username], (userErr, userRows) => {
    if (userErr) {
      console.log(userErr)
      res.send({ code: 500, message: '推荐计算失败' })
      return
    }

    if (!userRows.length) {
      const coldStartSql = `
        SELECT id, chinese_name, poster_path, vote_average, release_date, genres
        FROM movies
        ORDER BY popularity DESC
        LIMIT ?
      `
      db.query(coldStartSql, [limit], (coldErr, coldRows) => {
        if (coldErr) {
          console.log(coldErr)
          res.send({ code: 500, message: '推荐计算失败' })
          return
        }
        res.send({ code: 200, data: coldRows })
      })
      return
    }

    const userScoreMap = toScoreMap(userRows)
    const seenMovieIds = [...userScoreMap.keys()]

    const candidateSql = `
      SELECT id, chinese_name, poster_path, vote_average, release_date, genres, popularity
      FROM movies
      WHERE id NOT IN (?)
      LIMIT 1000
    `

    db.query(candidateSql, [seenMovieIds], (candidateErr, candidateRows) => {
      if (candidateErr) {
        console.log(candidateErr)
        res.send({ code: 500, message: '推荐计算失败' })
        return
      }

      if (!candidateRows.length) {
        res.send({ code: 200, data: [] })
        return
      }

      const allBehaviorSql = `
        SELECT username, movie_id, SUM(score) AS total_score
        FROM user_movie_behaviors
        GROUP BY username, movie_id
      `

      db.query(allBehaviorSql, (allErr, behaviorRows) => {
        if (allErr) {
          console.log(allErr)
          res.send({ code: 500, message: '推荐计算失败' })
          return
        }

        const candidateMovieIds = candidateRows.map((item) => item.id)
        const { scores: itemCfScores, movieScoresByUser } = calculateItemCfScores(
          candidateMovieIds,
          userScoreMap,
          behaviorRows
        )

        // UserCF只作为补充，权重保持较小
        const userCfScores = calculateUserCfScores(candidateMovieIds, username, userScoreMap, movieScoresByUser)

        const ranked = candidateRows
          .map((movie) => {
            const itemScore = itemCfScores.get(movie.id) || 0
            const userScore = userCfScores.get(movie.id) || 0
            const popularityScore = Number(movie.popularity) || 0
            const finalScore = itemScore * 0.85 + userScore * 0.1 + popularityScore * 0.05

            return {
              id: movie.id,
              chinese_name: movie.chinese_name,
              poster_path: movie.poster_path,
              vote_average: movie.vote_average,
              release_date: movie.release_date,
              genres: movie.genres,
              recommendation_score: Number(finalScore.toFixed(6))
            }
          })
          .sort((a, b) => b.recommendation_score - a.recommendation_score)
          .slice(0, limit)

        res.send({ code: 200, data: ranked })
      })
    })
  })
})

app.listen(3000, () => {
  console.log('API已启动 http://localhost:3000')
})
