/**
 * New England Jobs - UI Rendering
 * DOM manipulation, card rendering, and UI state management
 */

const UI = (() => {
    // Lazy loading observer for images
    let imageObserver = null;

    /**
     * Initialize the Intersection Observer for lazy loading
     */
    function initImageObserver() {
        if ('IntersectionObserver' in window) {
            imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        imageObserver.unobserve(img);
                    }
                });
            }, { rootMargin: '100px' });
        }
    }

    /**
     * Create a job card HTML string
     * @param {Object} job - Job object (with _qualification and _relevanceScore)
     * @param {boolean} isSaved - Whether the job is already saved
     * @returns {string} HTML string
     */
    function createJobCard(job, isSaved = false) {
        const qual = job._qualification || Filters.isQualifyingJob(job);
        const category = CONFIG.JOB_CATEGORIES[qual.category] || CONFIG.JOB_CATEGORIES['remote'];
        const score = job._relevanceScore !== undefined ? job._relevanceScore : 5;
        const salary = Utils.formatSalary(job.job_min_salary, job.job_max_salary);
        const postedDate = Utils.formatRelativeDate(job.job_posted_at_datetime_utc);
        const location = Utils.getJobLocation(job);

        // Score styling
        let scoreClass = 'score-low';
        if (score >= 7) scoreClass = 'score-high';
        else if (score >= 4) scoreClass = 'score-medium';

        // Highlights
        const qualifications = (job.job_highlights?.Qualifications || []).slice(0, 3);
        const responsibilities = (job.job_highlights?.Responsibilities || []).slice(0, 2);

        const logoSrc = job.employer_logo || 'assets/images/default-logo.png';

        return `
            <div class="job-card" role="listitem" data-job-id="${Utils.sanitize(job.job_id)}" tabindex="0">
                <div class="job-card-header">
                    <img class="job-card-logo"
                         src="assets/images/default-logo.png"
                         data-src="${Utils.sanitize(logoSrc)}"
                         alt="${Utils.sanitize(job.employer_name || 'Company')} logo"
                         loading="lazy"
                         onerror="this.src='assets/images/default-logo.png'">
                    <div class="job-card-info">
                        <h3 class="job-card-title">
                            <a href="${Utils.sanitize(job.job_apply_link || '#')}"
                               target="_blank"
                               rel="noopener noreferrer"
                               title="View job posting"
                               onclick="event.stopPropagation()">
                                ${Utils.sanitize(job.job_title)}
                            </a>
                        </h3>
                        <p class="job-card-company">${Utils.sanitize(job.employer_name)}</p>
                    </div>
                    <div class="job-card-badges">
                        <span class="badge ${category.cssClass}">${Utils.sanitize(category.label)}</span>
                    </div>
                </div>

                <div class="job-card-meta">
                    <span class="job-card-meta-item">${Utils.sanitize(location)}</span>
                    ${salary ? `<span class="job-card-meta-item job-card-salary">${salary}</span>` : ''}
                    ${job.job_employment_type ? `<span class="job-card-meta-item">${Utils.sanitize(formatEmploymentType(job.job_employment_type))}</span>` : ''}
                    ${job.job_publisher ? `<span class="job-card-meta-item">via ${Utils.sanitize(job.job_publisher)}</span>` : ''}
                </div>

                ${qualifications.length > 0 ? `
                    <div class="job-card-highlights">
                        <h4>Qualifications</h4>
                        <ul>
                            ${qualifications.map(q => `<li>${Utils.sanitize(Utils.truncate(q, 120))}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${responsibilities.length > 0 ? `
                    <div class="job-card-highlights">
                        <h4>Responsibilities</h4>
                        <ul>
                            ${responsibilities.map(r => `<li>${Utils.sanitize(Utils.truncate(r, 120))}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="job-card-footer">
                    <div class="job-card-score">
                        <span>Relevance:</span>
                        <div class="score-bar">
                            <div class="score-fill ${scoreClass}" style="width: ${score * 10}%"></div>
                        </div>
                        <span>${score}/10</span>
                    </div>
                    <span class="job-card-date">${postedDate}</span>
                    <div class="job-card-actions">
                        <button class="btn btn-small btn-secondary save-job-btn"
                                onclick="event.stopPropagation(); SavedJobs.toggleSave('${Utils.sanitize(job.job_id)}')"
                                aria-label="${isSaved ? 'Unsave' : 'Save'} this job"
                                title="${isSaved ? 'Remove from saved' : 'Save job'}">
                            ${isSaved ? 'Saved' : 'Save'}
                        </button>
                        <a href="${Utils.sanitize(job.job_apply_link || '#')}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="btn btn-small btn-primary"
                           onclick="event.stopPropagation()"
                           aria-label="Apply for ${Utils.sanitize(job.job_title)}">
                            Apply
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format employment type for display
     * @param {string} type - Raw employment type
     * @returns {string} Human-readable type
     */
    function formatEmploymentType(type) {
        const types = {
            'FULLTIME': 'Full-time',
            'PARTTIME': 'Part-time',
            'CONTRACTOR': 'Contract',
            'INTERN': 'Internship',
            'TEMPORARY': 'Temporary'
        };
        return types[type] || type;
    }

    /**
     * Render job cards into the grid
     * @param {Array} jobs - Array of job objects
     * @param {number} page - Current page number
     * @param {number} perPage - Results per page
     */
    function renderJobCards(jobs, page = 1, perPage = CONFIG.RESULTS_PER_PAGE) {
        const grid = document.getElementById('jobs-grid');
        if (!grid) return;

        const start = (page - 1) * perPage;
        const end = start + perPage;
        const pageJobs = jobs.slice(start, end);

        const savedJobIds = SavedJobs.getSavedIds();

        grid.innerHTML = pageJobs.map(job =>
            createJobCard(job, savedJobIds.has(job.job_id))
        ).join('');

        // Set up lazy loading for images
        if (imageObserver) {
            grid.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Fallback: load all images immediately
            grid.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
            });
        }

        // Set up card click handlers for detail view
        grid.querySelectorAll('.job-card').forEach(card => {
            card.addEventListener('click', () => {
                const jobId = card.dataset.jobId;
                const job = jobs.find(j => j.job_id === jobId);
                if (job) showJobDetail(job);
            });

            // Keyboard support
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }

    /**
     * Show the job detail modal
     * @param {Object} job - Job object
     */
    function showJobDetail(job) {
        const modal = document.getElementById('job-detail-modal');
        const modalBody = document.getElementById('modal-body');
        if (!modal || !modalBody) return;

        const qual = job._qualification || Filters.isQualifyingJob(job);
        const category = CONFIG.JOB_CATEGORIES[qual.category] || CONFIG.JOB_CATEGORIES['remote'];
        const salary = Utils.formatSalary(job.job_min_salary, job.job_max_salary);
        const location = Utils.getJobLocation(job);
        const isSaved = SavedJobs.isSaved(job.job_id);

        const qualifications = job.job_highlights?.Qualifications || [];
        const responsibilities = job.job_highlights?.Responsibilities || [];
        const description = job.job_description || 'No description available.';

        modalBody.innerHTML = `
            <div class="job-detail-header">
                <img class="job-detail-logo"
                     src="${Utils.sanitize(job.employer_logo || 'assets/images/default-logo.png')}"
                     alt="${Utils.sanitize(job.employer_name)} logo"
                     onerror="this.src='assets/images/default-logo.png'">
                <div>
                    <h2 id="modal-job-title" class="job-detail-title">${Utils.sanitize(job.job_title)}</h2>
                    <p class="job-detail-company">${Utils.sanitize(job.employer_name)}</p>
                    <div class="job-detail-meta">
                        <span class="badge ${category.cssClass}">${Utils.sanitize(category.label)}</span>
                        <span>${Utils.sanitize(location)}</span>
                        ${salary ? `<span class="job-card-salary">${salary}</span>` : ''}
                        ${job.job_employment_type ? `<span>${Utils.sanitize(formatEmploymentType(job.job_employment_type))}</span>` : ''}
                    </div>
                </div>
            </div>

            ${qualifications.length > 0 ? `
                <div class="job-detail-section">
                    <h3>Qualifications</h3>
                    <ul>
                        ${qualifications.map(q => `<li>${Utils.sanitize(q)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            ${responsibilities.length > 0 ? `
                <div class="job-detail-section">
                    <h3>Responsibilities</h3>
                    <ul>
                        ${responsibilities.map(r => `<li>${Utils.sanitize(r)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="job-detail-section">
                <h3>Description</h3>
                <div class="job-detail-description">${Utils.sanitize(Utils.truncate(description, 3000))}</div>
            </div>

            <div class="job-detail-actions">
                <button class="btn btn-secondary save-detail-btn"
                        onclick="SavedJobs.toggleSave('${Utils.sanitize(job.job_id)}'); UI.refreshDetailSaveBtn('${Utils.sanitize(job.job_id)}');">
                    ${isSaved ? 'Unsave' : 'Save Job'}
                </button>
                <a href="${Utils.sanitize(job.job_apply_link || '#')}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn btn-primary">
                    Apply Now
                </a>
            </div>

            <div style="margin-top: var(--space-3); font-size: var(--font-size-xs); color: var(--color-gray-400);">
                Posted: ${Utils.formatRelativeDate(job.job_posted_at_datetime_utc)}
                ${job.job_publisher ? ` | via ${Utils.sanitize(job.job_publisher)}` : ''}
            </div>
        `;

        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        // Store job data for save functionality
        modal.dataset.currentJobId = job.job_id;
        window._currentDetailJob = job;

        // Focus the close button
        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) closeBtn.focus();
    }

    /**
     * Refresh the save button text in the detail modal
     * @param {string} jobId - Job ID
     */
    function refreshDetailSaveBtn(jobId) {
        const btn = document.querySelector('.save-detail-btn');
        if (btn) {
            btn.textContent = SavedJobs.isSaved(jobId) ? 'Unsave' : 'Save Job';
        }
    }

    /**
     * Close the job detail modal
     */
    function closeJobDetail() {
        const modal = document.getElementById('job-detail-modal');
        if (modal) {
            modal.hidden = true;
            document.body.style.overflow = '';
        }
    }

    /**
     * Show/hide UI states
     * @param {string} state - State to show: 'loading', 'error', 'empty', 'welcome', 'results'
     * @param {Object} options - Additional options for the state
     */
    function showState(state, options = {}) {
        const states = ['loading-state', 'error-state', 'empty-state', 'welcome-state'];
        const grid = document.getElementById('jobs-grid');
        const resultsHeader = document.getElementById('results-header');
        const pagination = document.getElementById('pagination');
        const rateLimitWarning = document.getElementById('rate-limit-warning');

        // Hide all states
        states.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        if (rateLimitWarning) rateLimitWarning.hidden = true;

        switch (state) {
            case 'loading':
                document.getElementById('loading-state').hidden = false;
                if (grid) grid.innerHTML = '';
                if (resultsHeader) resultsHeader.hidden = true;
                if (pagination) pagination.hidden = true;
                const loadingText = document.getElementById('loading-text');
                if (loadingText && options.message) {
                    loadingText.textContent = options.message;
                }
                break;

            case 'error':
                document.getElementById('error-state').hidden = false;
                if (grid) grid.innerHTML = '';
                if (resultsHeader) resultsHeader.hidden = true;
                if (pagination) pagination.hidden = true;
                const errorTitle = document.getElementById('error-title');
                const errorMessage = document.getElementById('error-message');
                if (errorTitle && options.title) errorTitle.textContent = options.title;
                if (errorMessage && options.message) errorMessage.textContent = options.message;
                break;

            case 'empty':
                document.getElementById('empty-state').hidden = false;
                if (grid) grid.innerHTML = '';
                if (resultsHeader) resultsHeader.hidden = true;
                if (pagination) pagination.hidden = true;
                break;

            case 'welcome':
                document.getElementById('welcome-state').hidden = false;
                if (grid) grid.innerHTML = '';
                if (resultsHeader) resultsHeader.hidden = true;
                if (pagination) pagination.hidden = true;
                break;

            case 'results':
                if (grid) grid.innerHTML = '';
                if (resultsHeader) resultsHeader.hidden = false;
                break;

            case 'rate-limited':
                if (rateLimitWarning) rateLimitWarning.hidden = false;
                break;
        }
    }

    /**
     * Update results header with count and category breakdown
     * @param {number} total - Total number of results
     * @param {Object} breakdown - Category breakdown
     */
    function updateResultsHeader(total, breakdown = {}) {
        const countEl = document.getElementById('results-count');
        const categoriesEl = document.getElementById('results-categories');

        if (countEl) {
            countEl.textContent = `${total} job${total !== 1 ? 's' : ''} found`;
        }

        if (categoriesEl) {
            const parts = Object.entries(breakdown).map(([cat, count]) => {
                const category = CONFIG.JOB_CATEGORIES[cat];
                if (!category) return '';
                return `<span class="category-count"><span class="badge ${category.cssClass}">${count}</span></span>`;
            });
            categoriesEl.innerHTML = parts.join('');
        }
    }

    /**
     * Update pagination controls
     * @param {number} currentPage - Current page
     * @param {number} totalResults - Total number of results
     * @param {number} perPage - Results per page
     */
    function updatePagination(currentPage, totalResults, perPage) {
        const paginationEl = document.getElementById('pagination');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const infoEl = document.getElementById('pagination-info');

        if (!paginationEl) return;

        const totalPages = Math.ceil(totalResults / perPage);
        paginationEl.hidden = totalPages <= 1;

        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
        if (infoEl) infoEl.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    /**
     * Update the saved jobs count badge in navigation
     */
    function updateSavedCount() {
        const badges = document.querySelectorAll('#saved-count');
        const count = SavedJobs.getCount();
        badges.forEach(badge => {
            badge.textContent = count > 0 ? count : '';
        });
    }

    /**
     * Update the alerts count badge in navigation
     */
    function updateAlertsCount() {
        const badges = document.querySelectorAll('#alerts-count');
        const count = Alerts.getCount();
        badges.forEach(badge => {
            badge.textContent = count > 0 ? count : '';
        });
    }

    /**
     * Set search button loading state
     * @param {boolean} loading - Whether loading
     */
    function setSearchLoading(loading) {
        const btn = document.getElementById('search-btn');
        const text = btn?.querySelector('.search-btn-text');
        const spinner = btn?.querySelector('.search-btn-loading');

        if (btn) btn.disabled = loading;
        if (text) text.hidden = loading;
        if (spinner) spinner.hidden = !loading;
    }

    /**
     * Check and show API key banner if needed
     */
    function checkApiKeyBanner() {
        const banner = document.getElementById('api-key-banner');
        if (banner) {
            banner.hidden = JobsAPI.hasApiKey();
        }
    }

    return {
        initImageObserver,
        createJobCard,
        renderJobCards,
        showJobDetail,
        closeJobDetail,
        refreshDetailSaveBtn,
        showState,
        updateResultsHeader,
        updatePagination,
        updateSavedCount,
        updateAlertsCount,
        setSearchLoading,
        checkApiKeyBanner
    };
})();
