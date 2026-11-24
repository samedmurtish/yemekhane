const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT || 6379),
  retryStrategy(times) {
    return Math.min(times * 100, 2000);
  }
});

redis.on('error', (error) => {
  console.error(`[REDIS ERROR] ${error.message}`);
});

function sessionKey(token) {
  return `oturum:${token}`;
}

function menuKey(canteenId, date, mealId) {
  return `menu:${canteenId}:${date}:${mealId}`;
}

function secondsUntilEndOfDay() {
  const now = new Date();
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});

  const endOfDayUtc = Date.UTC(
    Number(localParts.year),
    Number(localParts.month) - 1,
    Number(localParts.day),
    20,
    59,
    59
  );
  return Math.max(1, Math.floor((endOfDayUtc - now.getTime()) / 1000));
}

async function createSession(token, user) {
  await redis.set(sessionKey(token), JSON.stringify(user), 'EX', 1800);
}

async function getSession(token) {
  const value = await redis.get(sessionKey(token));
  return value ? JSON.parse(value) : null;
}

async function refreshSession(token) {
  await redis.expire(sessionKey(token), 1800);
}

async function deleteSession(token) {
  await redis.del(sessionKey(token));
}

async function getMenu(key) {
  const value = await redis.get(key);
  return value ? JSON.parse(value) : null;
}

async function setMenu(key, value) {
  await redis.set(key, JSON.stringify(value), 'EX', secondsUntilEndOfDay());
}

async function invalidateMenu(key) {
  await redis.del(key);
  console.log(`[CACHE INVALIDATE] ${key}`);
}

async function clearMenuCaches() {
  let cursor = '0';
  let deleted = 0;
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'menu:*',
      'COUNT',
      100
    );
    cursor = nextCursor;
    if (keys.length) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== '0');
  console.log(`[CACHE CLEANUP] menu:* deleted=${deleted}`);
}

module.exports = {
  redis,
  menuKey,
  createSession,
  getSession,
  refreshSession,
  deleteSession,
  getMenu,
  setMenu,
  invalidateMenu
  ,clearMenuCaches
};
