const USERS_KEY = 'movie_users'
const CURRENT_USER_KEY = 'movie_current_user'

function getUsers() {
  return uni.getStorageSync(USERS_KEY) || []
}

function setUsers(users) {
  uni.setStorageSync(USERS_KEY, users)
}

export function registerUser(payload) {
  const users = getUsers()
  const exists = users.find((item) => item.username === payload.username)

  if (exists) {
    return { ok: false, message: '用户名已存在' }
  }

  users.push({
    username: payload.username,
    password: payload.password,
    nickname: payload.nickname || payload.username,
    createdAt: Date.now()
  })

  setUsers(users)
  return { ok: true, message: '注册成功，请登录' }
}

export function loginUser(payload) {
  const users = getUsers()
  const user = users.find(
    (item) => item.username === payload.username && item.password === payload.password
  )

  if (!user) {
    return { ok: false, message: '用户名或密码错误' }
  }

  uni.setStorageSync(CURRENT_USER_KEY, {
    username: user.username,
    nickname: user.nickname
  })

  return { ok: true, message: '登录成功' }
}

export function getCurrentUser() {
  return uni.getStorageSync(CURRENT_USER_KEY) || null
}

export function logoutUser() {
  uni.removeStorageSync(CURRENT_USER_KEY)
}
