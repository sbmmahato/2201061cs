const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

app.use(cors());
app.use(express.json());

// Helper function to fetch data from the social media API
const fetchFromAPI = async (endpoint) => {
    try {
        const response = await axios.get(`${process.env.BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${process.env.AUTH_TOKEN}`
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching from ${endpoint}:`, error.message);
        throw error;
    }
};

// Get top 5 users with highest number of posts
app.get('/users', async (req, res) => {
    try {
        // Check cache first
        const cachedUsers = cache.get('topUsers');
        if (cachedUsers) {
            return res.json(cachedUsers);
        }

        // Fetch all users
        const usersData = await fetchFromAPI('/users');
        const users = usersData.users; // Extract the users object
        
        // Fetch posts for each user and count them
        const userPostCounts = await Promise.all(
            Object.entries(users).map(async ([userId, userName]) => {
                const posts = await fetchFromAPI(`/users/${userId}/posts`);
                return {
                    userId,
                    userName,
                    postCount: posts.posts.length
                };
            })
        );

        // Sort by post count and get top 5
        const topUsers = userPostCounts
            .sort((a, b) => b.postCount - a.postCount)
            .slice(0, 5);

        // Cache the result
        cache.set('topUsers', topUsers);
        
        res.json(topUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top users' });
    }
});

// Get posts (popular or latest)
app.get('/posts', async (req, res) => {
    try {
        const { type } = req.query;
        
        if (!type || !['popular', 'latest'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid type parameter. Use "popular" or "latest"' 
            });
        }

        // Check cache first
        const cacheKey = `posts_${type}`;
        const cachedPosts = cache.get(cacheKey);
        if (cachedPosts) {
            return res.json(cachedPosts);
        }

        // Fetch all users
        const usersData = await fetchFromAPI('/users');
        const users = usersData.users; // Extract the users object
        
        // Fetch all posts
        const allPosts = await Promise.all(
            Object.keys(users).map(userId => 
                fetchFromAPI(`/users/${userId}/posts`)
            )
        );

        // Flatten posts array
        const posts = allPosts.flatMap(userPosts => userPosts.posts);

        let result;
        if (type === 'popular') {
            // Get posts with most comments
            const postsWithComments = await Promise.all(
                posts.map(async (post) => {
                    const comments = await fetchFromAPI(`/posts/${post.id}/comments`);
                    return {
                        ...post,
                        commentCount: comments.comments.length
                    };
                })
            );

            // Find maximum comment count
            const maxComments = Math.max(
                ...postsWithComments.map(p => p.commentCount)
            );

            // Get all posts with maximum comments
            result = postsWithComments
                .filter(post => post.commentCount === maxComments)
                .slice(0, 5);
        } else {
            // Get latest 5 posts
            result = posts
                .sort((a, b) => b.id - a.id)
                .slice(0, 5);
        }

        // Cache the result
        cache.set(cacheKey, result);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 