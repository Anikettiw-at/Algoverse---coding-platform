const { createClient }  = require('redis');

const redisClient = createClient({
    username: process.env.REDIS_USER || 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_HOST || 'redis-11331.c9.us-east-1-2.ec2.cloud.redislabs.com',
        port: Number(process.env.REDIS_PORT) || 11331
    }
});

redisClient.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redisClient;
