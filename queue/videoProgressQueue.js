import Queue from 'bull';

let progressQueue;

try {
    progressQueue = new Queue('video-progress', {
        redis: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        }
    });

    progressQueue.client.on('ready', () => {
        //console.log('Redis connected successfully.');
    });

    progressQueue.client.on('error', (err) => {
        console.error('Redis connection error:', err);
    });
} catch (error) {
    console.error('Failed to initialize Redis queue:', error);
}

export default progressQueue;