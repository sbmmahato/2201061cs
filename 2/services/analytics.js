const axios = require('axios');
const NodeCache = require('node-cache');
const { BASE_URL, CACHE_TTL, AUTH_TOKEN } = process.env;

const cache = new NodeCache({ stdTTL: CACHE_TTL });

// Create axios instance with default config
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
    }
});

// Fetch all users
async function fetchUsers() {
    try {
        const response = await api.get('/users');
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

// Fetch posts for a specific user
async function fetchUserPosts(userId) {
    try {
        const response = await api.get(`/users/${userId}/posts`);
        return response.data.posts;
    } catch (error) {
        console.error(`Error fetching posts for user ${userId}:`, error);
        return [];
    }
}

// Fetch comments for a specific post
async function fetchPostComments(postId) {
    try {
        const response = await api.get(`/posts/${postId}/comments`);
        return response.data.comments;
    } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        return [];
    }
}

// Get top 5 users with highest number of posts
async function getTopUsers() {
    const cacheKey = 'topUsers';
    const cachedData = cache.get(cacheKey);
    if (cachedData) return cachedData;

    const users = await fetchUsers();
    const userPostCounts = [];

    // Fetch posts for each user
    for (const [userId, userName] of Object.entries(users)) {
        const posts = await fetchUserPosts(userId);
        userPostCounts.push({
            userId,
            userName,
            postCount: posts.length
        });
    }

    // Sort by post count and get top 5
    const topUsers = userPostCounts
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, 5);

    cache.set(cacheKey, topUsers);
    return topUsers;
}

// Get posts based on type (popular or latest)
async function getPosts(type) {
    const cacheKey = `posts_${type}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return cachedData;

    const users = await fetchUsers();
    let allPosts = [];

    // Fetch all posts
    for (const userId of Object.keys(users)) {
        const posts = await fetchUserPosts(userId);
        allPosts = allPosts.concat(posts);
    }

    if (type === 'popular') {
        // Get posts with most comments
        const postsWithComments = await Promise.all(
            allPosts.map(async (post) => {
                const comments = await fetchPostComments(post.id);
                return {
                    ...post,
                    commentCount: comments.length
                };
            })
        );

        // Sort by comment count and get top posts
        const maxComments = Math.max(...postsWithComments.map(p => p.commentCount));
        const popularPosts = postsWithComments
            .filter(post => post.commentCount === maxComments)
            .slice(0, 5);

        cache.set(cacheKey, popularPosts);
        return popularPosts;
    } else {
        // Get latest 5 posts
        const latestPosts = allPosts
            .sort((a, b) => b.id - a.id)
            .slice(0, 5);

        cache.set(cacheKey, latestPosts);
        return latestPosts;
    }
}

module.exports = {
    getTopUsers,
    getPosts
}; 