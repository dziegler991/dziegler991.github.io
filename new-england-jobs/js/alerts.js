/**
 * New England Jobs - Alert System
 * Create, manage, and check job alerts with browser notifications
 */

const Alerts = (() => {
    const STORAGE_KEY = 'jobAlerts';
    const SEEN_JOBS_KEY = 'seenJobs';

    /**
     * Get all alerts from storage
     * @returns {Array} Array of alert objects
     */
    function getAlerts() {
        return Utils.getStorage(STORAGE_KEY, []);
    }

    /**
     * Save alerts to storage
     * @param {Array} alerts - Array of alert objects
     */
    function saveAlerts(alerts) {
        Utils.setStorage(STORAGE_KEY, alerts);
    }

    /**
     * Get the count of alerts
     * @returns {number} Number of alerts
     */
    function getCount() {
        return getAlerts().length;
    }

    /**
     * Create a new alert
     * @param {Object} alertData - Alert configuration
     * @returns {Object} Created alert
     */
    function createAlert(alertData) {
        const alerts = getAlerts();
        const newAlert = {
            id: Utils.generateId(),
            keywords: alertData.keywords || [],
            themes: alertData.themes || [],
            preferences: {
                categories: alertData.categories || Object.keys(CONFIG.JOB_CATEGORIES),
                states: alertData.states || Object.keys(CONFIG.NE_STATES),
                minSalary: alertData.minSalary || 0,
                jobTypes: alertData.jobTypes || ['FULLTIME']
            },
            frequency: alertData.frequency || 'daily',
            lastChecked: null,
            created: new Date().toISOString()
        };

        alerts.push(newAlert);
        saveAlerts(alerts);
        return newAlert;
    }

    /**
     * Update an existing alert
     * @param {string} alertId - Alert ID
     * @param {Object} updates - Fields to update
     * @returns {Object|null} Updated alert or null
     */
    function updateAlert(alertId, updates) {
        const alerts = getAlerts();
        const index = alerts.findIndex(a => a.id === alertId);
        if (index === -1) return null;

        alerts[index] = { ...alerts[index], ...updates };
        saveAlerts(alerts);
        return alerts[index];
    }

    /**
     * Delete an alert
     * @param {string} alertId - Alert ID to delete
     * @returns {boolean} Success
     */
    function deleteAlert(alertId) {
        const alerts = getAlerts();
        const filtered = alerts.filter(a => a.id !== alertId);
        if (filtered.length === alerts.length) return false;
        saveAlerts(filtered);
        return true;
    }

    /**
     * Get an alert by ID
     * @param {string} alertId - Alert ID
     * @returns {Object|null} Alert or null
     */
    function getAlert(alertId) {
        return getAlerts().find(a => a.id === alertId) || null;
    }

    /**
     * Get seen job IDs
     * @returns {Set} Set of seen job IDs
     */
    function getSeenJobs() {
        return new Set(Utils.getStorage(SEEN_JOBS_KEY, []));
    }

    /**
     * Mark jobs as seen
     * @param {Array<string>} jobIds - Job IDs to mark as seen
     */
    function markJobsSeen(jobIds) {
        const seen = Utils.getStorage(SEEN_JOBS_KEY, []);
        const newSeen = [...new Set([...seen, ...jobIds])];
        // Keep only last 1000 seen jobs to avoid storage bloat
        if (newSeen.length > 1000) {
            newSeen.splice(0, newSeen.length - 1000);
        }
        Utils.setStorage(SEEN_JOBS_KEY, newSeen);
    }

    /**
     * Request browser notification permission
     * @returns {Promise<string>} Permission result
     */
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        if (Notification.permission === 'granted') {
            return 'granted';
        }
        if (Notification.permission === 'denied') {
            return 'denied';
        }
        return await Notification.requestPermission();
    }

    /**
     * Send a browser notification
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     */
    function sendNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        try {
            new Notification(title, {
                body: body,
                icon: 'assets/icons/favicon.ico'
            });
        } catch {
            // Notification failed silently
        }
    }

    /**
     * Check alerts against new job listings
     * @param {Array} jobs - Array of job objects
     * @returns {Object} Alert check results
     */
    function checkAlerts(jobs) {
        const alerts = getAlerts();
        const seenJobs = getSeenJobs();
        const results = {
            totalNew: 0,
            alertResults: []
        };

        for (const alert of alerts) {
            const matchingJobs = jobs.filter(job => {
                // Skip already-seen jobs
                if (seenJobs.has(job.job_id)) return false;

                // Check keywords
                const hasKeywordMatch = alert.keywords.some(keyword => {
                    const kw = keyword.toLowerCase();
                    return (job.job_title || '').toLowerCase().includes(kw) ||
                           (job.job_description || '').toLowerCase().includes(kw);
                });

                if (!hasKeywordMatch && alert.keywords.length > 0) return false;

                // Check category
                const qual = job._qualification || Filters.isQualifyingJob(job);
                if (!qual.qualifies) return false;
                if (!alert.preferences.categories.includes(qual.category)) return false;

                // Check salary
                if (alert.preferences.minSalary > 0) {
                    const jobSalary = job.job_max_salary || job.job_min_salary || 0;
                    if (jobSalary > 0 && jobSalary < alert.preferences.minSalary) return false;
                }

                return true;
            });

            if (matchingJobs.length > 0) {
                results.totalNew += matchingJobs.length;
                results.alertResults.push({
                    alert: alert,
                    newJobs: matchingJobs
                });
            }
        }

        // Mark all checked jobs as seen
        if (jobs.length > 0) {
            markJobsSeen(jobs.map(j => j.job_id));
        }

        // Send notification if there are new matches
        if (results.totalNew > 0) {
            sendNotification(
                'New Job Matches',
                `Found ${results.totalNew} new job${results.totalNew > 1 ? 's' : ''} matching your alerts.`
            );
        }

        // Update last checked time for all alerts
        const updatedAlerts = getAlerts().map(a => ({
            ...a,
            lastChecked: new Date().toISOString()
        }));
        saveAlerts(updatedAlerts);

        return results;
    }

    /**
     * Render the alerts list on the alerts page
     */
    function renderAlertsList() {
        const listEl = document.getElementById('alerts-list');
        const emptyEl = document.getElementById('alerts-empty-state');
        if (!listEl) return;

        const alerts = getAlerts();

        if (alerts.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.hidden = false;
            return;
        }

        if (emptyEl) emptyEl.hidden = true;

        listEl.innerHTML = alerts.map(alert => {
            const categories = alert.preferences.categories.map(cat => {
                const catInfo = CONFIG.JOB_CATEGORIES[cat];
                return catInfo ? `<span class="badge ${catInfo.cssClass}">${Utils.sanitize(catInfo.label)}</span>` : '';
            }).join('');

            const states = alert.preferences.states.join(', ');
            const salary = alert.preferences.minSalary > 0
                ? `$${(alert.preferences.minSalary / 1000).toFixed(0)}k+`
                : 'Any';

            return `
                <div class="alert-card" role="listitem" data-alert-id="${Utils.sanitize(alert.id)}">
                    <div class="alert-card-header">
                        <div class="alert-card-title">
                            ${Utils.sanitize(alert.keywords.join(', ') || 'All Jobs')}
                        </div>
                        <div class="alert-card-actions">
                            <button class="btn btn-small btn-secondary edit-alert-btn"
                                    onclick="Alerts.openEditModal('${Utils.sanitize(alert.id)}')"
                                    aria-label="Edit alert">
                                Edit
                            </button>
                            <button class="btn btn-small btn-danger delete-alert-btn"
                                    onclick="Alerts.confirmDelete('${Utils.sanitize(alert.id)}')"
                                    aria-label="Delete alert">
                                Delete
                            </button>
                        </div>
                    </div>

                    ${alert.themes && alert.themes.length > 0 ? `
                        <div class="alert-card-keywords">
                            ${alert.themes.map(t => `<span class="keyword-tag">${Utils.sanitize(t)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="alert-card-categories">
                        ${categories}
                    </div>

                    <div class="alert-card-details">
                        <span class="alert-card-detail">States: ${Utils.sanitize(states)}</span>
                        <span class="alert-card-detail">Min Salary: ${salary}</span>
                        <span class="alert-card-detail">Frequency: ${Utils.sanitize(alert.frequency)}</span>
                    </div>

                    <div class="alert-card-footer">
                        <span>Created: ${Utils.formatRelativeDate(alert.created)}</span>
                        <span>Last checked: ${alert.lastChecked ? Utils.formatRelativeDate(alert.lastChecked) : 'Never'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Open the alert creation/edit modal
     * @param {string|null} alertId - Alert ID to edit, or null for new
     */
    function openEditModal(alertId = null) {
        const modal = document.getElementById('alert-modal');
        const form = document.getElementById('alert-form');
        const title = document.getElementById('alert-modal-title');
        if (!modal || !form) return;

        const alert = alertId ? getAlert(alertId) : null;

        if (title) title.textContent = alert ? 'Edit Job Alert' : 'Create Job Alert';

        // Populate form
        const keywordsInput = document.getElementById('alert-keywords');
        const themesInput = document.getElementById('alert-themes');
        const minSalary = document.getElementById('alert-min-salary');
        const frequency = document.getElementById('alert-frequency');

        if (keywordsInput) keywordsInput.value = alert ? alert.keywords.join(', ') : '';
        if (themesInput) themesInput.value = alert ? (alert.themes || []).join(', ') : '';
        if (minSalary) minSalary.value = alert ? alert.preferences.minSalary : 0;
        if (frequency) frequency.value = alert ? alert.frequency : 'daily';

        // Set category checkboxes
        const categoryBoxes = form.querySelectorAll('input[name="alert-category"]');
        categoryBoxes.forEach(cb => {
            cb.checked = alert
                ? alert.preferences.categories.includes(cb.value)
                : true;
        });

        // Set state checkboxes
        const stateBoxes = form.querySelectorAll('input[name="alert-state"]');
        stateBoxes.forEach(cb => {
            cb.checked = alert
                ? alert.preferences.states.includes(cb.value)
                : true;
        });

        // Set job type checkboxes
        const jobTypeBoxes = form.querySelectorAll('input[name="alert-jobtype"]');
        jobTypeBoxes.forEach(cb => {
            cb.checked = alert
                ? (alert.preferences.jobTypes || ['FULLTIME']).includes(cb.value)
                : cb.value === 'FULLTIME';
        });

        // Store editing state
        form.dataset.editingId = alertId || '';

        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        if (keywordsInput) keywordsInput.focus();
    }

    /**
     * Close the alert modal
     */
    function closeModal() {
        const modal = document.getElementById('alert-modal');
        if (modal) {
            modal.hidden = true;
            document.body.style.overflow = '';
        }
    }

    /**
     * Handle alert form submission
     * @param {Event} e - Submit event
     */
    function handleFormSubmit(e) {
        e.preventDefault();
        const form = document.getElementById('alert-form');
        if (!form) return;

        const keywordsRaw = document.getElementById('alert-keywords')?.value || '';
        const themesRaw = document.getElementById('alert-themes')?.value || '';

        const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
        const themes = themesRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

        if (keywords.length === 0) {
            Utils.showToast('Please enter at least one keyword.', 'warning');
            return;
        }

        const categories = Array.from(form.querySelectorAll('input[name="alert-category"]:checked'))
            .map(cb => cb.value);
        const states = Array.from(form.querySelectorAll('input[name="alert-state"]:checked'))
            .map(cb => cb.value);
        const jobTypes = Array.from(form.querySelectorAll('input[name="alert-jobtype"]:checked'))
            .map(cb => cb.value);
        const minSalary = parseInt(document.getElementById('alert-min-salary')?.value || '0', 10);
        const frequency = document.getElementById('alert-frequency')?.value || 'daily';

        const editingId = form.dataset.editingId;

        if (editingId) {
            updateAlert(editingId, {
                keywords,
                themes,
                preferences: { categories, states, minSalary, jobTypes },
                frequency
            });
            Utils.showToast('Alert updated successfully.', 'success');
        } else {
            createAlert({ keywords, themes, categories, states, minSalary, jobTypes, frequency });
            // Request notification permission on first alert creation
            requestNotificationPermission();
            Utils.showToast('Alert created successfully.', 'success');
        }

        closeModal();
        renderAlertsList();
        UI.updateAlertsCount();
    }

    /**
     * Confirm and delete an alert
     * @param {string} alertId - Alert ID
     */
    function confirmDelete(alertId) {
        if (confirm('Are you sure you want to delete this alert?')) {
            deleteAlert(alertId);
            renderAlertsList();
            UI.updateAlertsCount();
            Utils.showToast('Alert deleted.', 'success');
        }
    }

    return {
        getAlerts,
        getCount,
        createAlert,
        updateAlert,
        deleteAlert,
        getAlert,
        checkAlerts,
        renderAlertsList,
        openEditModal,
        closeModal,
        handleFormSubmit,
        confirmDelete,
        requestNotificationPermission
    };
})();
