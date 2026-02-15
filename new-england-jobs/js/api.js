/**
 * New England Jobs - API Integration
 * Handles all communication with the JSearch RapidAPI
 */

const JobsAPI = (() => {
    // Rate limiter state
    const requestLog = [];

    /**
     * Check if we can make a request (rate limiting)
     * @returns {boolean} Whether a request is allowed
     */
    function canMakeRequest() {
        const now = Date.now();
        const windowStart = now - CONFIG.RATE_LIMIT.windowMs;
        // Remove old entries
        while (requestLog.length > 0 && requestLog[0] < windowStart) {
            requestLog.shift();
        }
        return requestLog.length < CONFIG.RATE_LIMIT.maxRequests;
    }

    /**
     * Record a request for rate limiting
     */
    function recordRequest() {
        requestLog.push(Date.now());
    }

    /**
     * Get the current API key
     * @returns {string} API key
     */
    function getApiKey() {
        return CONFIG.RAPID_API_KEY || localStorage.getItem('ne_jobs_api_key') || '';
    }

    /**
     * Check if an API key is configured
     * @returns {boolean} Whether an API key exists
     */
    function hasApiKey() {
        return getApiKey().length > 0;
    }

    /**
     * Save API key to localStorage
     * @param {string} key - API key to save
     */
    function saveApiKey(key) {
        localStorage.setItem('ne_jobs_api_key', key);
        CONFIG.RAPID_API_KEY = key;
    }

    /**
     * Make a request to the JSearch API
     * @param {string} endpoint - API endpoint path
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} API response data
     */
    async function fetchFromAPI(endpoint, params) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured. Please add your RapidAPI key.');
        }

        if (!canMakeRequest()) {
            throw new Error('RATE_LIMITED');
        }

        if (!Utils.isOnline()) {
            throw new Error('You appear to be offline. Please check your internet connection.');
        }

        const queryString = new URLSearchParams(params).toString();
        const url = `${CONFIG.API_BASE_URL}/${endpoint}?${queryString}`;

        // Check cache first
        const cacheKey = `api_cache_${url}`;
        const cached = Utils.getSessionCache(cacheKey);
        if (cached) {
            return cached;
        }

        recordRequest();

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': CONFIG.RAPID_API_HOST
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('RATE_LIMITED');
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error('Invalid API key. Please check your RapidAPI key and try again.');
            }
            throw new Error(`API request failed (${response.status}). Please try again.`);
        }

        const data = await response.json();
        Utils.setSessionCache(cacheKey, data);
        return data;
    }

    /**
     * Search for jobs with given query and options
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async function searchJobs(query, options = {}) {
        const params = {
            query: query,
            page: options.page || 1,
            num_pages: 1,
            date_posted: options.datePosted || 'week'
        };

        if (options.remoteOnly) {
            params.remote_jobs_only = true;
        }

        if (options.employmentTypes && options.employmentTypes.length > 0) {
            params.employment_types = options.employmentTypes.join(',');
        }

        return fetchFromAPI('search', params);
    }

    /**
     * Build and execute multiple search queries for comprehensive NE coverage
     * @param {string} keywords - Search keywords
     * @param {Object} options - Search options
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Deduplicated job results
     */
    async function searchAllCategories(keywords, options = {}, onProgress = null) {
        const queries = buildSearchQueries(keywords, options);
        const allJobs = [];
        const seenIds = new Set();
        let completed = 0;

        // Execute queries with concurrency limit
        const concurrencyLimit = 3;
        const results = [];

        for (let i = 0; i < queries.length; i += concurrencyLimit) {
            const batch = queries.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.allSettled(
                batch.map(q => searchJobs(q.query, q.options))
            );
            results.push(...batchResults);
            completed += batch.length;

            if (onProgress) {
                onProgress(completed, queries.length);
            }
        }

        // Collect and deduplicate results
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value && result.value.data) {
                for (const job of result.value.data) {
                    if (!seenIds.has(job.job_id)) {
                        seenIds.add(job.job_id);
                        allJobs.push(job);
                    }
                }
            }
        }

        return allJobs;
    }

    /**
     * Build search queries for comprehensive coverage
     * @param {string} keywords - Search keywords
     * @param {Object} options - Search options
     * @returns {Array<Object>} Array of query objects
     */
    function buildSearchQueries(keywords, options = {}) {
        const queries = [];
        const baseOptions = {
            datePosted: options.datePosted || 'week',
            page: options.page || 1
        };

        if (options.employmentTypes && options.employmentTypes.length > 0) {
            baseOptions.employmentTypes = options.employmentTypes;
        }

        // 1. Remote jobs query
        queries.push({
            query: `${keywords} remote`,
            options: { ...baseOptions, remoteOnly: true }
        });

        // 2. City-specific queries for major NE cities
        const selectedStates = options.states || Object.keys(CONFIG.NE_STATES);
        const citiesToSearch = [];

        for (const stateCode of selectedStates) {
            const stateInfo = CONFIG.NE_STATES[stateCode];
            if (stateInfo) {
                // Use the first (major) city from each selected state
                citiesToSearch.push(stateInfo.cities[0] + ', ' + stateCode);
            }
        }

        for (const city of citiesToSearch) {
            queries.push({
                query: `${keywords} in ${city}`,
                options: { ...baseOptions }
            });
        }

        return queries;
    }

    /**
     * Retry a failed API call with exponential backoff
     * @param {Function} fn - Async function to retry
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<*>} Result of the function
     */
    async function withRetry(fn, maxRetries = 2) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (error.message === 'RATE_LIMITED') throw error;
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }

    return {
        hasApiKey,
        saveApiKey,
        getApiKey,
        searchJobs,
        searchAllCategories,
        withRetry,
        canMakeRequest
    };
})();
