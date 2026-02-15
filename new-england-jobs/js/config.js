/**
 * New England Jobs - Configuration
 *
 * WARNING: API keys in client-side code are visible to anyone who inspects the source.
 * Use free-tier API keys only. For production with sensitive keys, use a serverless backend.
 */

// Try to load key from localStorage (set via UI) or use placeholder
const CONFIG = {
    // RapidAPI Configuration
    RAPID_API_KEY: localStorage.getItem('ne_jobs_api_key') || '',
    RAPID_API_HOST: 'jsearch.p.rapidapi.com',
    API_BASE_URL: 'https://jsearch.p.rapidapi.com',

    // Fallback API
    FALLBACK_API_HOST: 'jobs-search-realtime-data.p.rapidapi.com',
    FALLBACK_API_URL: 'https://jobs-search-realtime-data.p.rapidapi.com',

    // New England States
    NE_STATES: {
        CT: { name: 'Connecticut', cities: ['Hartford', 'New Haven', 'Stamford', 'Bridgeport', 'Waterbury'] },
        MA: { name: 'Massachusetts', cities: ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Lowell'] },
        ME: { name: 'Maine', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'] },
        NH: { name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord', 'Dover', 'Rochester'] },
        RI: { name: 'Rhode Island', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'] },
        VT: { name: 'Vermont', cities: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'] }
    },

    // Major NE cities for search queries
    MAJOR_NE_CITIES: ['Boston', 'Hartford', 'Providence', 'Portland ME', 'Manchester NH', 'Burlington VT'],

    // Job Categories
    JOB_CATEGORIES: {
        'remote': { label: 'Remote', color: '#10b981', icon: '\uD83C\uDF10', cssClass: 'badge-remote' },
        'remote-us': { label: 'Remote (US)', color: '#3b82f6', icon: '\uD83C\uDDFA\uD83C\uDDF8', cssClass: 'badge-remote-us' },
        'hybrid-ne': { label: 'Hybrid (NE)', color: '#f59e0b', icon: '\uD83C\uDFE2', cssClass: 'badge-hybrid' },
        'onsite-ne': { label: 'On-site (NE)', color: '#6366f1', icon: '\uD83D\uDCCD', cssClass: 'badge-onsite' },
        'remote-ne-company': { label: 'Remote (NE Co.)', color: '#8b5cf6', icon: '\u2B50', cssClass: 'badge-remote-ne' }
    },

    // Rate Limiting
    RATE_LIMIT: {
        maxRequests: 10,
        windowMs: 60000 // 1 minute
    },

    // Cache
    CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes

    // Pagination
    RESULTS_PER_PAGE: 20,

    // Debounce
    DEBOUNCE_MS: 300,

    // Default preferences
    DEFAULT_PREFERENCES: {
        defaultCategories: ['remote', 'remote-us', 'hybrid-ne', 'onsite-ne', 'remote-ne-company'],
        defaultStates: ['CT', 'MA', 'ME', 'NH', 'RI', 'VT'],
        resultsPerPage: 20,
        sortBy: 'relevance',
        theme: 'light'
    }
};
