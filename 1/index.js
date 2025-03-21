require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 9876;
const windowSize = parseInt(process.env.WINDOW_SIZE) || 10;
const apiBaseUrl = process.env.API_BASE_URL;

// Store for numbers based on type
const numberStore = {
    p: [], // prime
    f: [], // fibonacci
    e: [], // even
    r: []  // random
};

// Function to calculate average
const calculateAverage = (numbers) => {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, curr) => acc + curr, 0);
    return (sum / numbers.length).toFixed(2);
};

// Function to fetch numbers from API
const fetchNumbers = async (type) => {
    try {
        const response = await axios.get(`${apiBaseUrl}/${type}`, {
            headers: {
                'Authorization': `Bearer ${process.env.AUTH_TOKEN}`
            },
            timeout: 500 // 500ms timeout
        });
        return response.data.numbers;
    } catch (error) {
        console.error(`Error fetching ${type} numbers:`, error.message);
        return [];
    }
};

// Function to update number store
const updateNumberStore = (type, newNumbers) => {
    const store = numberStore[type];
    const windowPrevState = [...store];
    
    // Add new numbers and remove duplicates
    newNumbers.forEach(num => {
        if (!store.includes(num)) {
            store.push(num);
        }
    });
    
    // Maintain window size
    while (store.length > windowSize) {
        store.shift();
    }
    
    return windowPrevState;
};

// Main route handler
app.get('/numbers/:type', async (req, res) => {
    const type = req.params.type;
    
    // Validate type
    if (!['p', 'f', 'e', 'r'].includes(type)) {
        return res.status(400).json({
            error: 'Invalid number type'
        });
    }

    // Map type to API endpoint
    const typeMap = {
        'p': 'primes',
        'f': 'fibo',
        'e': 'even',
        'r': 'rand'
    };

    // Fetch new numbers
    const newNumbers = await fetchNumbers(typeMap[type]);
    
    // Update store and get previous state
    const windowPrevState = updateNumberStore(type, newNumbers);
    
    // Prepare response
    const response = {
        windowPrevState,
        windowCurrState: numberStore[type],
        numbers: newNumbers,
        avg: calculateAverage(numberStore[type])
    };

    res.json(response);
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 