/**
 * New England Jobs - Saved Jobs Management
 * Save, manage, export, and display saved job listings
 */

const SavedJobs = (() => {
    const STORAGE_KEY = 'savedJobs';

    /**
     * Get all saved jobs from storage
     * @returns {Array} Array of saved job objects
     */
    function getSavedJobs() {
        return Utils.getStorage(STORAGE_KEY, []);
    }

    /**
     * Save the jobs list to storage
     * @param {Array} jobs - Array of saved job objects
     */
    function saveToDisk(jobs) {
        Utils.setStorage(STORAGE_KEY, jobs);
    }

    /**
     * Get count of saved jobs
     * @returns {number} Number of saved jobs
     */
    function getCount() {
        return getSavedJobs().length;
    }

    /**
     * Get a set of saved job IDs for quick lookup
     * @returns {Set<string>} Set of saved job IDs
     */
    function getSavedIds() {
        return new Set(getSavedJobs().map(j => j.job_id));
    }

    /**
     * Check if a job is already saved
     * @param {string} jobId - Job ID
     * @returns {boolean} Whether the job is saved
     */
    function isSaved(jobId) {
        return getSavedJobs().some(j => j.job_id === jobId);
    }

    /**
     * Save a job
     * @param {Object} jobData - Full job object
     * @returns {boolean} Success
     */
    function saveJob(jobData) {
        const jobs = getSavedJobs();
        if (jobs.some(j => j.job_id === jobData.job_id)) return false;

        jobs.push({
            job_id: jobData.job_id,
            saved_at: new Date().toISOString(),
            notes: '',
            job_data: jobData
        });

        saveToDisk(jobs);
        return true;
    }

    /**
     * Remove a saved job
     * @param {string} jobId - Job ID to remove
     * @returns {boolean} Success
     */
    function removeJob(jobId) {
        const jobs = getSavedJobs();
        const filtered = jobs.filter(j => j.job_id !== jobId);
        if (filtered.length === jobs.length) return false;
        saveToDisk(filtered);
        return true;
    }

    /**
     * Toggle save state for a job
     * @param {string} jobId - Job ID
     */
    function toggleSave(jobId) {
        if (isSaved(jobId)) {
            removeJob(jobId);
            Utils.showToast('Job removed from saved.', 'info');
        } else {
            // Find the job in the current results
            const job = window._currentSearchResults?.find(j => j.job_id === jobId)
                || window._currentDetailJob;

            if (job) {
                saveJob(job);
                Utils.showToast('Job saved!', 'success');
            } else {
                Utils.showToast('Could not save job. Try again.', 'error');
                return;
            }
        }

        UI.updateSavedCount();

        // Refresh save buttons in the current view
        document.querySelectorAll(`.job-card[data-job-id="${jobId}"] .save-job-btn`).forEach(btn => {
            btn.textContent = isSaved(jobId) ? 'Saved' : 'Save';
        });
    }

    /**
     * Update notes for a saved job
     * @param {string} jobId - Job ID
     * @param {string} notes - New notes text
     * @returns {boolean} Success
     */
    function updateNotes(jobId, notes) {
        const jobs = getSavedJobs();
        const job = jobs.find(j => j.job_id === jobId);
        if (!job) return false;
        job.notes = notes;
        saveToDisk(jobs);
        return true;
    }

    /**
     * Clear all saved jobs
     */
    function clearAll() {
        saveToDisk([]);
    }

    /**
     * Export saved jobs as JSON
     */
    function exportJSON() {
        const jobs = getSavedJobs();
        if (jobs.length === 0) {
            Utils.showToast('No saved jobs to export.', 'warning');
            return;
        }
        const json = JSON.stringify(jobs, null, 2);
        Utils.downloadFile(json, 'saved-jobs.json', 'application/json');
        Utils.showToast('Exported as JSON.', 'success');
    }

    /**
     * Export saved jobs as CSV
     */
    function exportCSV() {
        const jobs = getSavedJobs();
        if (jobs.length === 0) {
            Utils.showToast('No saved jobs to export.', 'warning');
            return;
        }
        const csv = Utils.jobsToCSV(jobs);
        Utils.downloadFile(csv, 'saved-jobs.csv', 'text/csv');
        Utils.showToast('Exported as CSV.', 'success');
    }

    /**
     * Render the saved jobs page
     */
    function renderSavedJobsList() {
        const listEl = document.getElementById('saved-jobs-list');
        const emptyEl = document.getElementById('saved-empty-state');
        if (!listEl) return;

        const jobs = getSavedJobs();

        if (jobs.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.hidden = false;
            return;
        }

        if (emptyEl) emptyEl.hidden = true;

        listEl.innerHTML = jobs.map(saved => {
            const job = saved.job_data;
            const qual = Filters.isQualifyingJob(job);
            const category = CONFIG.JOB_CATEGORIES[qual.category] || CONFIG.JOB_CATEGORIES['remote'];
            const salary = Utils.formatSalary(job.job_min_salary, job.job_max_salary);
            const location = Utils.getJobLocation(job);

            return `
                <div class="saved-job-card" role="listitem" data-job-id="${Utils.sanitize(job.job_id)}">
                    <div class="saved-job-header">
                        <img class="job-card-logo"
                             src="${Utils.sanitize(job.employer_logo || 'assets/images/default-logo.png')}"
                             alt="${Utils.sanitize(job.employer_name)} logo"
                             onerror="this.src='assets/images/default-logo.png'">
                        <div class="saved-job-info">
                            <h3 class="saved-job-title">${Utils.sanitize(job.job_title)}</h3>
                            <p class="saved-job-company">${Utils.sanitize(job.employer_name)}</p>
                        </div>
                        <span class="badge ${category.cssClass}">${Utils.sanitize(category.label)}</span>
                    </div>

                    <div class="saved-job-meta">
                        <span>${Utils.sanitize(location)}</span>
                        ${salary ? `<span class="job-card-salary">${salary}</span>` : ''}
                        ${job.job_employment_type ? `<span>${Utils.sanitize(job.job_employment_type)}</span>` : ''}
                    </div>

                    ${saved.notes ? `
                        <div class="saved-job-notes">${Utils.sanitize(saved.notes)}</div>
                    ` : ''}

                    <div class="saved-job-actions">
                        <a href="${Utils.sanitize(job.job_apply_link || '#')}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="btn btn-small btn-primary">
                            Apply
                        </a>
                        <button class="btn btn-small btn-secondary"
                                onclick="SavedJobs.openNotesModal('${Utils.sanitize(job.job_id)}')"
                                aria-label="Add notes">
                            Notes
                        </button>
                        <button class="btn btn-small btn-danger"
                                onclick="SavedJobs.confirmRemove('${Utils.sanitize(job.job_id)}')"
                                aria-label="Remove saved job">
                            Remove
                        </button>
                        <span class="saved-job-date">Saved ${Utils.formatRelativeDate(saved.saved_at)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Open the notes modal for a saved job
     * @param {string} jobId - Job ID
     */
    function openNotesModal(jobId) {
        const modal = document.getElementById('notes-modal');
        const textarea = document.getElementById('job-notes-textarea');
        if (!modal || !textarea) return;

        const saved = getSavedJobs().find(j => j.job_id === jobId);
        if (!saved) return;

        textarea.value = saved.notes || '';
        modal.dataset.jobId = jobId;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        textarea.focus();
    }

    /**
     * Close the notes modal
     */
    function closeNotesModal() {
        const modal = document.getElementById('notes-modal');
        if (modal) {
            modal.hidden = true;
            document.body.style.overflow = '';
        }
    }

    /**
     * Save notes from the modal
     */
    function saveNotesFromModal() {
        const modal = document.getElementById('notes-modal');
        const textarea = document.getElementById('job-notes-textarea');
        if (!modal || !textarea) return;

        const jobId = modal.dataset.jobId;
        if (jobId) {
            updateNotes(jobId, textarea.value);
            Utils.showToast('Notes saved.', 'success');
            renderSavedJobsList();
        }
        closeNotesModal();
    }

    /**
     * Confirm and remove a saved job
     * @param {string} jobId - Job ID
     */
    function confirmRemove(jobId) {
        if (confirm('Remove this job from your saved list?')) {
            removeJob(jobId);
            renderSavedJobsList();
            UI.updateSavedCount();
            Utils.showToast('Job removed.', 'info');
        }
    }

    /**
     * Confirm and clear all saved jobs
     */
    function confirmClearAll() {
        if (confirm('Remove all saved jobs? This cannot be undone.')) {
            clearAll();
            renderSavedJobsList();
            UI.updateSavedCount();
            Utils.showToast('All saved jobs removed.', 'info');
        }
    }

    return {
        getSavedJobs,
        getCount,
        getSavedIds,
        isSaved,
        saveJob,
        removeJob,
        toggleSave,
        updateNotes,
        clearAll,
        exportJSON,
        exportCSV,
        renderSavedJobsList,
        openNotesModal,
        closeNotesModal,
        saveNotesFromModal,
        confirmRemove,
        confirmClearAll
    };
})();
