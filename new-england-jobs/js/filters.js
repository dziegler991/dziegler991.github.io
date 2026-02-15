/**
 * New England Jobs - Filters & Relevance Scoring
 * Location qualification, job categorization, and relevance scoring
 */

const Filters = (() => {
    // NE state codes for quick lookup
    const NE_STATE_CODES = new Set(['CT', 'MA', 'ME', 'NH', 'RI', 'VT']);

    // NE state full names for text matching
    const NE_STATE_NAMES = {
        'connecticut': 'CT',
        'massachusetts': 'MA',
        'maine': 'ME',
        'new hampshire': 'NH',
        'rhode island': 'RI',
        'vermont': 'VT'
    };

    // All NE cities flattened for matching
    const ALL_NE_CITIES = new Set();
    for (const stateCode of Object.keys(CONFIG.NE_STATES)) {
        for (const city of CONFIG.NE_STATES[stateCode].cities) {
            ALL_NE_CITIES.add(city.toLowerCase());
        }
    }

    /**
     * Determine if a job qualifies and what category it belongs to
     * @param {Object} job - Job object from API
     * @returns {Object} Qualification result: { qualifies, category, reason }
     */
    function isQualifyingJob(job) {
        const isRemote = job.job_is_remote === true;
        const jobState = (job.job_state || '').toUpperCase().trim();
        const jobCity = (job.job_city || '').toLowerCase().trim();
        const jobCountry = (job.job_country || '').toUpperCase().trim();
        const title = (job.job_title || '').toLowerCase();
        const description = (job.job_description || '').toLowerCase();

        // Check if the job is in a NE state
        const isInNEState = NE_STATE_CODES.has(jobState) || isNELocation(job);

        // Check for hybrid keywords
        const isHybrid = /hybrid/i.test(title) || /hybrid/i.test(description);

        // Category determination
        if (isRemote && isInNEState) {
            return {
                qualifies: true,
                category: 'remote-ne-company',
                reason: `Remote position from ${job.job_city || ''}, ${jobState} company`
            };
        }

        if (isRemote && jobCountry === 'US') {
            return {
                qualifies: true,
                category: 'remote-us',
                reason: 'Remote position available in the US'
            };
        }

        if (isRemote) {
            return {
                qualifies: true,
                category: 'remote',
                reason: 'Fully remote position'
            };
        }

        if (isInNEState && isHybrid) {
            return {
                qualifies: true,
                category: 'hybrid-ne',
                reason: `Hybrid position in ${job.job_city || ''}, ${jobState}`
            };
        }

        if (isInNEState) {
            return {
                qualifies: true,
                category: 'onsite-ne',
                reason: `On-site position in ${job.job_city || ''}, ${jobState}`
            };
        }

        // Non-NE hybrid
        if (isHybrid) {
            return {
                qualifies: true,
                category: 'hybrid-ne',
                reason: `Hybrid position in ${job.job_city || ''}, ${jobState || jobCountry}`
            };
        }

        // Non-NE on-site - still show it, categorize as on-site
        return {
            qualifies: true,
            category: 'onsite-ne',
            reason: `On-site position in ${job.job_city || ''}, ${jobState || jobCountry}`
        };
    }

    /**
     * Check if a job's location is in New England (broader matching)
     * @param {Object} job - Job object
     * @returns {boolean} Whether the job is in NE
     */
    function isNELocation(job) {
        const state = (job.job_state || '').trim();
        const city = (job.job_city || '').toLowerCase().trim();
        const description = (job.job_description || '').toLowerCase();

        // Direct state code match
        if (NE_STATE_CODES.has(state.toUpperCase())) return true;

        // State name match
        for (const [name, code] of Object.entries(NE_STATE_NAMES)) {
            if (state.toLowerCase() === name) return true;
            // Check if state name appears in description with city context
            if (description.includes(name) && ALL_NE_CITIES.has(city)) return true;
        }

        // City match
        if (ALL_NE_CITIES.has(city)) return true;

        return false;
    }

    /**
     * Get the NE state code for a job (if applicable)
     * @param {Object} job - Job object
     * @returns {string|null} Two-letter state code or null
     */
    function getJobNEState(job) {
        const state = (job.job_state || '').trim().toUpperCase();
        if (NE_STATE_CODES.has(state)) return state;

        const stateLower = (job.job_state || '').trim().toLowerCase();
        if (NE_STATE_NAMES[stateLower]) return NE_STATE_NAMES[stateLower];

        // Check city
        const city = (job.job_city || '').toLowerCase().trim();
        for (const [stateCode, stateInfo] of Object.entries(CONFIG.NE_STATES)) {
            if (stateInfo.cities.some(c => c.toLowerCase() === city)) {
                return stateCode;
            }
        }

        return null;
    }

    /**
     * Score job relevance based on keywords, themes, and sports/marketing fit (0-10)
     * Automatically boosts jobs matching sports, winter sports, and marketing themes.
     * @param {Object} job - Job object
     * @param {string} keywords - Search keywords
     * @param {Array<string>} themes - Optional theme keywords
     * @returns {number} Relevance score 0-10
     */
    function scoreJobRelevance(job, keywords, themes = []) {
        if (!keywords && themes.length === 0) return 5;

        let score = 0;
        const maxScore = 10;

        const searchTerms = keywords
            .toLowerCase()
            .split(/[\s,]+/)
            .filter(t => t.length > 1);

        const themeTerms = themes
            .map(t => t.toLowerCase().trim())
            .filter(t => t.length > 1);

        const title = (job.job_title || '').toLowerCase();
        const description = (job.job_description || '').toLowerCase();
        const company = (job.employer_name || '').toLowerCase();
        const allText = title + ' ' + description + ' ' + company;

        const qualifications = (job.job_highlights?.Qualifications || []).join(' ').toLowerCase();
        const responsibilities = (job.job_highlights?.Responsibilities || []).join(' ').toLowerCase();

        // Title matches (up to 3 points)
        let titleMatches = 0;
        for (const term of searchTerms) {
            if (title.includes(term)) titleMatches++;
        }
        score += Math.min(3, titleMatches * 1.5);

        // Description/highlights matches (up to 2 points)
        let contentMatches = 0;
        for (const term of searchTerms) {
            if (description.includes(term)) contentMatches++;
            if (qualifications.includes(term)) contentMatches += 0.5;
            if (responsibilities.includes(term)) contentMatches += 0.5;
        }
        score += Math.min(2, contentMatches);

        // User-provided theme matches (up to 1 point)
        let themeMatches = 0;
        for (const theme of themeTerms) {
            if (title.includes(theme)) themeMatches += 1;
            if (description.includes(theme)) themeMatches += 0.5;
        }
        score += Math.min(1, themeMatches);

        // Built-in sports/winter sports bonus (up to 2 points)
        let sportsScore = 0;
        for (const theme of (CONFIG.SPORTS_THEMES || [])) {
            if (title.includes(theme)) { sportsScore += 1.5; break; }
        }
        for (const theme of (CONFIG.SPORTS_THEMES || [])) {
            if (allText.includes(theme)) { sportsScore += 0.5; break; }
        }
        score += Math.min(2, sportsScore);

        // Built-in marketing role bonus (up to 1 point)
        for (const kw of (CONFIG.MARKETING_KEYWORDS || [])) {
            if (title.includes(kw)) { score += 1; break; }
        }

        // Company name match bonus (1 point)
        for (const term of searchTerms) {
            if (company.includes(term)) {
                score += 1;
                break;
            }
        }

        return Math.min(maxScore, Math.round(score));
    }

    /**
     * Apply all filters to a list of jobs
     * @param {Array} jobs - Array of job objects
     * @param {Object} filterOptions - Filter criteria
     * @returns {Array} Filtered and annotated jobs
     */
    function applyFilters(jobs, filterOptions = {}) {
        const {
            categories = Object.keys(CONFIG.JOB_CATEGORIES),
            states = Object.keys(CONFIG.NE_STATES),
            minSalary = 0,
            keywords = '',
            themes = [],
            sortBy = 'relevance'
        } = filterOptions;

        const categoriesSet = new Set(categories);
        const statesSet = new Set(states);

        // Filter and annotate
        let filtered = jobs
            .map(job => {
                const qualification = isQualifyingJob(job);
                const relevanceScore = scoreJobRelevance(job, keywords, themes);

                return {
                    ...job,
                    _qualification: qualification,
                    _relevanceScore: relevanceScore,
                    _neState: getJobNEState(job)
                };
            })
            .filter(job => {
                // Must qualify
                if (!job._qualification.qualifies) return false;

                // Category filter
                if (!categoriesSet.has(job._qualification.category)) return false;

                // State filter (only for location-based categories)
                const locationCategories = ['hybrid-ne', 'onsite-ne', 'remote-ne-company'];
                if (locationCategories.includes(job._qualification.category)) {
                    if (job._neState && !statesSet.has(job._neState)) return false;
                }

                // Salary filter
                if (minSalary > 0) {
                    const jobMaxSalary = job.job_max_salary || job.job_min_salary || 0;
                    if (jobMaxSalary > 0 && jobMaxSalary < minSalary) return false;
                }

                return true;
            });

        // Sort
        filtered = sortJobs(filtered, sortBy);

        return filtered;
    }

    /**
     * Sort jobs by specified criteria
     * @param {Array} jobs - Jobs to sort
     * @param {string} sortBy - Sort criterion
     * @returns {Array} Sorted jobs
     */
    function sortJobs(jobs, sortBy) {
        switch (sortBy) {
            case 'relevance':
                return jobs.sort((a, b) => b._relevanceScore - a._relevanceScore);

            case 'date':
                return jobs.sort((a, b) => {
                    const dateA = new Date(a.job_posted_at_datetime_utc || 0);
                    const dateB = new Date(b.job_posted_at_datetime_utc || 0);
                    return dateB - dateA;
                });

            case 'salary-high':
                return jobs.sort((a, b) => {
                    const salaryA = a.job_max_salary || a.job_min_salary || 0;
                    const salaryB = b.job_max_salary || b.job_min_salary || 0;
                    return salaryB - salaryA;
                });

            case 'salary-low':
                return jobs.sort((a, b) => {
                    const salaryA = a.job_min_salary || a.job_max_salary || Infinity;
                    const salaryB = b.job_min_salary || b.job_max_salary || Infinity;
                    return salaryA - salaryB;
                });

            default:
                return jobs;
        }
    }

    /**
     * Get category breakdown from filtered results
     * @param {Array} jobs - Filtered job list
     * @returns {Object} Count by category
     */
    function getCategoryBreakdown(jobs) {
        const breakdown = {};
        for (const job of jobs) {
            const cat = job._qualification?.category;
            if (cat) {
                breakdown[cat] = (breakdown[cat] || 0) + 1;
            }
        }
        return breakdown;
    }

    return {
        isQualifyingJob,
        scoreJobRelevance,
        applyFilters,
        sortJobs,
        getCategoryBreakdown,
        getJobNEState
    };
})();
