/**
 * New England Jobs - Utility Functions
 */

const Utils = (() => {
    /**
     * Sanitize a string for safe HTML insertion (prevent XSS)
     * @param {string} str - Raw string
     * @returns {string} Sanitized string
     */
    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Format a date string relative to now
     * @param {string} dateStr - ISO date string
     * @returns {string} Relative time string
     */
    function formatRelativeDate(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /**
     * Format salary for display
     * @param {number|null} min - Minimum salary
     * @param {number|null} max - Maximum salary
     * @returns {string} Formatted salary range
     */
    function formatSalary(min, max) {
        if (!min && !max) return '';
        const format = (n) => {
            if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
            return '$' + n;
        };
        if (min && max) return `${format(min)} - ${format(max)}`;
        if (min) return `${format(min)}+`;
        return `Up to ${format(max)}`;
    }

    /**
     * Debounce a function call
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique identifier
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get data from localStorage with error handling
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Parsed value or default
     */
    function getStorage(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    /**
     * Set data in localStorage with error handling
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success
     */
    function setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get data from sessionStorage (for caching)
     * @param {string} key - Storage key
     * @returns {*|null} Parsed value or null
     */
    function getSessionCache(key) {
        try {
            const item = sessionStorage.getItem(key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            if (Date.now() - parsed.timestamp > CONFIG.CACHE_DURATION_MS) {
                sessionStorage.removeItem(key);
                return null;
            }
            return parsed.data;
        } catch {
            return null;
        }
    }

    /**
     * Set data in sessionStorage (for caching)
     * @param {string} key - Storage key
     * @param {*} data - Data to cache
     */
    function setSessionCache(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch {
            // SessionStorage full or not available - silently fail
        }
    }

    /**
     * Truncate text to a maximum length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated text
     */
    function truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text || '';
        return text.substring(0, maxLength).trim() + '...';
    }

    /**
     * Convert job data to CSV format
     * @param {Array} jobs - Array of job objects
     * @returns {string} CSV string
     */
    function jobsToCSV(jobs) {
        const headers = ['Title', 'Company', 'Location', 'Type', 'Salary', 'Posted', 'Apply Link', 'Notes'];
        const rows = jobs.map(item => {
            const job = item.job_data || item;
            return [
                escapeCSV(job.job_title || ''),
                escapeCSV(job.employer_name || ''),
                escapeCSV(getJobLocation(job)),
                escapeCSV(job.job_employment_type || ''),
                escapeCSV(formatSalary(job.job_min_salary, job.job_max_salary)),
                escapeCSV(job.job_posted_at_datetime_utc || ''),
                escapeCSV(job.job_apply_link || ''),
                escapeCSV(item.notes || '')
            ];
        });
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Escape a string for CSV
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeCSV(str) {
        if (!str) return '""';
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    /**
     * Get human-readable location for a job
     * @param {Object} job - Job object
     * @returns {string} Location string
     */
    function getJobLocation(job) {
        if (job.job_is_remote) return 'Remote';
        const parts = [job.job_city, job.job_state, job.job_country].filter(Boolean);
        return parts.join(', ') || 'Location not specified';
    }

    /**
     * Download a file to the user's machine
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} contentType - MIME type
     */
    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Show a toast notification
     * @param {string} message - Notification message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in ms (default 3000)
     */
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${sanitize(message)}</span>
            <button class="toast-dismiss" aria-label="Dismiss notification">&times;</button>
        `;

        container.appendChild(toast);

        const dismiss = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
        setTimeout(dismiss, duration);
    }

    /**
     * Check if the browser is online
     * @returns {boolean} Online status
     */
    function isOnline() {
        return navigator.onLine !== false;
    }

    return {
        sanitize,
        formatRelativeDate,
        formatSalary,
        debounce,
        generateId,
        getStorage,
        setStorage,
        getSessionCache,
        setSessionCache,
        truncate,
        jobsToCSV,
        getJobLocation,
        downloadFile,
        showToast,
        isOnline
    };
})();
