/**
 * Sports Marketing Jobs - Main Application
 * Initialization, event binding, and orchestration
 */

const App = (() => {
    let currentPage = 1;
    let currentKeywords = '';
    let filteredJobs = [];

    function init() {
        UI.initImageObserver();
        UI.updateSavedCount();
        UI.updateAlertsCount();

        bindGlobalEvents();
        detectPage();
    }

    function detectPage() {
        const path = window.location.pathname;

        if (path.includes('saved-jobs')) {
            initSavedJobsPage();
        } else if (path.includes('alerts')) {
            initAlertsPage();
        } else {
            initSearchPage();
        }
    }

    // ==========================================
    // Search Page
    // ==========================================

    function initSearchPage() {
        const searchForm = document.getElementById('search-form');
        const filtersToggle = document.getElementById('filters-toggle');
        const applyFiltersBtn = document.getElementById('apply-filters-btn');
        const resetFiltersBtn = document.getElementById('reset-filters-btn');
        const sortBy = document.getElementById('sort-by');
        const retryBtn = document.getElementById('retry-btn');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const apiKeyBtn = document.getElementById('save-api-key-btn');

        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleSearch();
            });
        }

        if (filtersToggle) {
            filtersToggle.addEventListener('click', toggleFilters);
        }

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                if (currentKeywords) refilterAndRender();
            });
        }

        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', resetFilters);
        }

        if (sortBy) {
            sortBy.addEventListener('change', () => {
                if (filteredJobs.length > 0) refilterAndRender();
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (currentKeywords) handleSearch();
            });
        }

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => changePage(-1));
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => changePage(1));
        }

        if (apiKeyBtn) {
            apiKeyBtn.addEventListener('click', handleSaveApiKey);
        }

        // Show welcome state; hide API key form if key already saved
        UI.showState('welcome');
        updateApiKeyVisibility();
    }

    /**
     * Handle API key save from the inline welcome form
     */
    function handleSaveApiKey() {
        const input = document.getElementById('api-key-input');
        if (!input) return;

        const key = input.value.trim();
        if (!key) {
            Utils.showToast('Please enter a valid API key.', 'warning');
            return;
        }

        JobsAPI.saveApiKey(key);
        updateApiKeyVisibility();
        Utils.showToast('API key saved! You can now search for jobs.', 'success');
    }

    /**
     * Hide the API key form if a key is already stored
     */
    function updateApiKeyVisibility() {
        const apiKeySection = document.getElementById('api-key-inline');
        if (apiKeySection) {
            apiKeySection.hidden = JobsAPI.hasApiKey();
        }
    }

    function toggleFilters() {
        const toggle = document.getElementById('filters-toggle');
        const panel = document.getElementById('filters-panel');
        if (!toggle || !panel) return;

        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !isExpanded);
        panel.hidden = isExpanded;
    }

    function resetFilters() {
        // Default: remote categories checked, hybrid/onsite unchecked
        document.querySelectorAll('input[name="category"]').forEach(cb => {
            cb.checked = cb.value === 'remote' || cb.value === 'remote-us';
        });

        document.querySelectorAll('input[name="state"]').forEach(cb => {
            cb.checked = true;
        });

        document.querySelectorAll('input[name="jobType"]').forEach(cb => {
            cb.checked = cb.value === 'FULLTIME';
        });

        const datePosted = document.getElementById('date-posted');
        const minSalary = document.getElementById('min-salary');
        const sortBy = document.getElementById('sort-by');
        if (datePosted) datePosted.value = 'week';
        if (minSalary) minSalary.value = '0';
        if (sortBy) sortBy.value = 'relevance';

        Utils.showToast('Filters reset.', 'info');
    }

    function getFilterValues() {
        const categories = Array.from(document.querySelectorAll('input[name="category"]:checked'))
            .map(cb => cb.value);
        let states = Array.from(document.querySelectorAll('input[name="state"]:checked'))
            .map(cb => cb.value);
        // Default to all states if no state checkboxes exist (remote-first mode)
        if (states.length === 0) {
            states = Object.keys(CONFIG.NE_STATES);
        }
        const jobTypes = Array.from(document.querySelectorAll('input[name="jobType"]:checked'))
            .map(cb => cb.value);
        const datePosted = document.getElementById('date-posted')?.value || 'week';
        const minSalary = parseInt(document.getElementById('min-salary')?.value || '0', 10);
        const sortBy = document.getElementById('sort-by')?.value || 'relevance';

        return { categories, states, jobTypes, datePosted, minSalary, sortBy };
    }

    async function handleSearch() {
        const input = document.getElementById('search-keywords');
        const keywords = (input?.value || '').trim();

        if (!keywords) {
            Utils.showToast('Please enter search keywords.', 'warning');
            if (input) input.focus();
            return;
        }

        if (!JobsAPI.hasApiKey()) {
            Utils.showToast('Please add your API key first.', 'warning');
            return;
        }

        currentKeywords = keywords;
        currentPage = 1;

        const filters = getFilterValues();

        UI.showState('loading', { message: 'Searching for jobs...' });
        UI.setSearchLoading(true);

        try {
            const rawJobs = await JobsAPI.withRetry(() =>
                JobsAPI.searchAllCategories(keywords, {
                    datePosted: filters.datePosted,
                    categories: filters.categories,
                    employmentTypes: filters.jobTypes,
                    page: 1
                }, (completed, total) => {
                    const loadingText = document.getElementById('loading-text');
                    if (loadingText) {
                        loadingText.textContent = `Searching... (${completed}/${total} queries)`;
                    }
                })
            );

            window._currentSearchResults = rawJobs;

            filteredJobs = Filters.applyFilters(rawJobs, {
                categories: filters.categories,
                states: filters.states,
                minSalary: filters.minSalary,
                keywords: keywords,
                sortBy: filters.sortBy
            });

            if (filteredJobs.length === 0) {
                UI.showState('empty');
            } else {
                UI.showState('results');
                renderResults();
            }

            const alertResults = Alerts.checkAlerts(rawJobs);
            if (alertResults.totalNew > 0) {
                Utils.showToast(
                    `${alertResults.totalNew} new job${alertResults.totalNew > 1 ? 's' : ''} match your alerts!`,
                    'success',
                    5000
                );
            }

        } catch (error) {
            if (error.message === 'RATE_LIMITED') {
                UI.showState('rate-limited');
                Utils.showToast('Rate limit reached. Please wait before searching again.', 'warning');
            } else {
                UI.showState('error', {
                    title: 'Search Failed',
                    message: error.message || 'Unable to fetch job listings. Please try again.'
                });
            }
        } finally {
            UI.setSearchLoading(false);
        }
    }

    function refilterAndRender() {
        const filters = getFilterValues();
        const rawJobs = window._currentSearchResults || [];

        filteredJobs = Filters.applyFilters(rawJobs, {
            categories: filters.categories,
            states: filters.states,
            minSalary: filters.minSalary,
            keywords: currentKeywords,
            sortBy: filters.sortBy
        });

        currentPage = 1;

        if (filteredJobs.length === 0) {
            UI.showState('empty');
        } else {
            UI.showState('results');
            renderResults();
        }
    }

    function renderResults() {
        const breakdown = Filters.getCategoryBreakdown(filteredJobs);
        UI.updateResultsHeader(filteredJobs.length, breakdown);
        UI.renderJobCards(filteredJobs, currentPage, CONFIG.RESULTS_PER_PAGE);
        UI.updatePagination(currentPage, filteredJobs.length, CONFIG.RESULTS_PER_PAGE);
    }

    function changePage(delta) {
        const totalPages = Math.ceil(filteredJobs.length / CONFIG.RESULTS_PER_PAGE);
        const newPage = currentPage + delta;
        if (newPage < 1 || newPage > totalPages) return;

        currentPage = newPage;
        renderResults();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ==========================================
    // Saved Jobs Page
    // ==========================================

    function initSavedJobsPage() {
        SavedJobs.renderSavedJobsList();

        const exportJsonBtn = document.getElementById('export-json-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        const clearAllBtn = document.getElementById('clear-all-saved-btn');
        const notesCloseBtn = document.getElementById('notes-modal-close');
        const notesCancelBtn = document.getElementById('notes-cancel-btn');
        const notesSaveBtn = document.getElementById('notes-save-btn');

        if (exportJsonBtn) exportJsonBtn.addEventListener('click', SavedJobs.exportJSON);
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', SavedJobs.exportCSV);
        if (clearAllBtn) clearAllBtn.addEventListener('click', SavedJobs.confirmClearAll);
        if (notesCloseBtn) notesCloseBtn.addEventListener('click', SavedJobs.closeNotesModal);
        if (notesCancelBtn) notesCancelBtn.addEventListener('click', SavedJobs.closeNotesModal);
        if (notesSaveBtn) notesSaveBtn.addEventListener('click', SavedJobs.saveNotesFromModal);
    }

    // ==========================================
    // Alerts Page
    // ==========================================

    function initAlertsPage() {
        Alerts.renderAlertsList();

        const createBtn = document.getElementById('create-alert-btn');
        const createEmptyBtn = document.getElementById('create-alert-empty-btn');
        const alertCloseBtn = document.getElementById('alert-modal-close');
        const alertCancelBtn = document.getElementById('alert-cancel-btn');
        const alertForm = document.getElementById('alert-form');

        if (createBtn) createBtn.addEventListener('click', () => Alerts.openEditModal());
        if (createEmptyBtn) createEmptyBtn.addEventListener('click', () => Alerts.openEditModal());
        if (alertCloseBtn) alertCloseBtn.addEventListener('click', Alerts.closeModal);
        if (alertCancelBtn) alertCancelBtn.addEventListener('click', Alerts.closeModal);
        if (alertForm) alertForm.addEventListener('submit', Alerts.handleFormSubmit);
    }

    // ==========================================
    // Global Events
    // ==========================================

    function bindGlobalEvents() {
        document.querySelectorAll('.nav-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const navLinks = toggle.closest('.main-nav')?.querySelector('.nav-links');
                if (navLinks) {
                    navLinks.classList.toggle('open');
                    const isOpen = navLinks.classList.contains('open');
                    toggle.setAttribute('aria-expanded', isOpen);
                }
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.hidden = true;
                    document.body.style.overflow = '';
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(overlay => {
                    if (!overlay.hidden) {
                        overlay.hidden = true;
                        document.body.style.overflow = '';
                    }
                });
            }
        });

        document.getElementById('modal-close-btn')?.addEventListener('click', UI.closeJobDetail);

        window.addEventListener('online', () => {
            Utils.showToast('You are back online.', 'success');
        });

        window.addEventListener('offline', () => {
            Utils.showToast('You appear to be offline.', 'warning');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        handleSearch,
        changePage
    };
})();
