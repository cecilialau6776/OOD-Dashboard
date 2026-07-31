import { jobQueueUrl, jobPathUrl } from './config'
import moment from 'moment-timezone';

function getTableHtml(data) {
  if (data.length === 0) {
    return `
      <div class="d-flex flex-column align-items-center justify-content-center h-100">
        <div class="mb-3">
          <i class="fas fa-tasks text-muted" style="font-size: 3rem;"></i>
        </div>
        <h5 class="mb-2">No Recent Jobs</h5>
        <p class="text-muted mb-0">Your recent jobs will appear here once you submit them.</p>
      </div>`;
  } else {
    const tableContentsHtml = data.map((job, index, array) => {
      var state_verbose = (SIMPLE_JOB_STATE_CODES[job.state.split(" ")[0]] || JOB_STATE_CODES[job.state.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
      var reason_verbose = (SIMPLE_JOB_REASON_CODES[job.reason.split(" ")[0]] || JOB_REASON_CODES[job.reason.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");

      // Format time display based on timestamp comparison with current time
      var timeDisplay = "";
      const now = moment();
      const endTime = moment(job.end_time);
      const startTime = moment(job.start_time);
      const submitTime = moment(job.submit_time);

      if (endTime.isBefore(now)) {
        timeDisplay = `Ended ${endTime.format('MMM D, h:mm A')}`;
      } else if (startTime.isBefore(now)) {
        timeDisplay = `Started ${startTime.format('MMM D, h:mm A')}`;
      } else {
        timeDisplay = `Submitted ${submitTime.format('MMM D, h:mm A')}`;
      }

      const jobBadge = job.reason !== "None" && reason_verbose !== "--"
        ? `<span class="badge rounded-pill text-bg-secondary ms-0 ms-md-1 shadow-sm d-flex align-items-center"
                 style="font-size: 0.8rem;"
                 data-bs-toggle="tooltip" 
                 data-bs-placement="top" 
                 title="${reason_verbose}">
             ${job.reason}
           </span>`
        : "";

      return `
      <div class="col-12 col-md-auto px-0 px-md-2 mb-2 mb-md-0">
        <a href="${jobPathUrl().replace('JOB_ID', job.jobid)}"
           class= "text-decoration-none" >
          <div class="d-flex flex-column w-100 p-3 bg-white rounded job-queue-card">
            <div class="d-flex flex-row justify-content-between align-items-start flex-md-column">
              <div class="flex-grow-1 text-truncate pe-3 pe-md-0">
                <div class="fw-bold text-truncate text-dark">${job.name.length > 40 ? job.name.substring(0, 40) + '...' : job.name}</div>
                <small class="text-muted text-truncate">${job.jobid} • ${job.partition}</small>
                <div class="text-muted mt-1 small">
                  <i class="fas fa-clock me-1"></i> ${timeDisplay}
                </div>
              </div>
              <div class="d-flex flex-column flex-md-row align-items-end align-items-md-center flex-shrink-0 mt-0 mt-md-2">
                <span class="badge p-2 shadow-sm d-flex align-items-center mb-1 mb-md-0"
                      style="font-size: 0.9rem; color: ${JOB_STATE_COLORS[job.state.split(" ")[0]]?.fg}; background-color: ${JOB_STATE_COLORS[job.state.split(" ")[0]]?.bg};"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      title="${state_verbose}">
                  ${job.state}
                </span>
                ${jobBadge}
              </div>
            </div>
          </div>
        </a>
      </div>
      `;
    }).join("");

    return `
    <div class="d-flex flex-column flex-md-row w-100 pb-2 overflow-y" style = "max-height: 250px;">
      <div class="d-flex flex-column flex-md-row flex-md-nowrap">
        ${tableContentsHtml}
      </div>
    </div>
    `;
  }
}

function loadJobQueue() {
  const loadingHtml = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100">
            <div class="position-relative mb-3">
                <div class="spinner-border text-secondary" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
            <p class="text-muted mb-0">Loading job queue data...</p>
        </div>
        `;

  $("#job_queue_card_content").html(loadingHtml);

  return fetch(jobQueueUrl())
    .then(response => {
      return response.json()
    })
    .then(data => {
        $("#job_queue_card_content").html(getTableHtml(data));

        $('[data-bs-toggle="tooltip"]').tooltip({ boundary: 'window' });
    })
    .catch(error => {
      const errorHtml = `
      <div class="d-flex flex-column align-items-center justify-content-center h-100 py-3">
        <div class="text-danger mb-3">
          <i class="fas fa-exclamation-circle fa-2x"></i>
        </div>
        <h5 class="mb-2">Unable to Load Recent Jobs</h5>
        <p class="text-muted small mb-3">There was a problem retrieving your job information</p>
        <button class="btn btn-sm action-btn" 
                style="background: hsl(0 0% 100%); border: 1px solid hsl(214.3 31.8% 91.4%); color: hsl(222.2 84% 4.9%); border-radius: 8px; padding: 0.5rem 1rem; font-weight: 500; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                onmouseover="this.style.background='hsl(210 40% 98%)'; this.style.borderColor='hsl(214.3 31.8% 85%)'"
                onmouseout="this.style.background='hsl(0 0% 100%)'; this.style.borderColor='hsl(214.3 31.8% 91.4%)'"
                onclick="loadJobQueue()">
          <i class="fas fa-sync-alt me-1"></i> Retry
        </button>
      </div>
      `;

      $("#job_queue_card_content").html(errorHtml);
      console.error(error);
    });
}

jQuery(() => {
  loadJobQueue();
  $("#job_queue_refresh_button").on("click", loadJobQueue);
});
