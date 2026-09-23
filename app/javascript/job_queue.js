import { jobQueueUrl, jobPathUrl } from './config'
import moment from 'moment-timezone';
import { clusterBadge, jobStateBadge } from './utils';

const widgetAttr = 'data-widget="job_queue"'

function getTableHtml(data) {
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

async function loadJobQueue() {
  $(`.refresh-btn[${widgetAttr}] i`).addClass('refresh-spin');

  fetch(jobQueueUrl())
    .then(response => response.json())
    .then(jobs => {
      if (jobs.length === 0) {
        $(`.none-div[${widgetAttr}]`).removeClass("d-none");
        return;
      }
      $(`.none-div[${widgetAttr}]`).addClass("d-none");
      const now = moment();
      const timeFormat = 'MMM D, h:mm A';

      const jobCards = jobs.map((job) => {
        const $timeDisplay = $("<div>", { "class": "text-muted small mb-2" })
          .append($("<i>", { "class": "fas fa-clock me-1" }));

        const endTime = moment(job.end_time.number * 1000);
        const startTime = moment(job.start_time.number * 1000);
        const submitTime = moment(job.submit_time.number * 1000);

        if (endTime.isBefore(now)) {
          $timeDisplay.append(`Ended ${endTime.format(timeFormat)}`);
        } else if (startTime.isBefore(now)) {
          $timeDisplay.append(`Started ${startTime.format(timeFormat)}`);
        } else {
          $timeDisplay.append(`Submitted ${submitTime.format(timeFormat)}`);
        }

        const $card = $("<div>", { "class": "card" })
          .append($("<div>", { "class": "card-body" })
            .append(
              $("<h5>", { "class": "card-title text-truncate" }).text(job.name.length > 40 ? job.name.substring(0, 40) + '...' : job.name),

              $("<small>", { "class": "text-muted text-truncate mb-2" })
                .append(
                  clusterBadge(job.cluster).css("font-size", ".75rem"),
                  " • ",
                  $("<a>", { "class": "stretched-link card-link", "href": jobPathUrl(job.cluster, job.job_id) }).text(job.job_id),
                  " • ",
                  job.partition,
                ),
              $timeDisplay,
              jobStateBadge(job.job_state[0]),
            ));

        const $cardWrapper = $("<div>", { "class": "col" }).append($card);

        return $cardWrapper;
      });

      $(`.card_content[${widgetAttr}]`)
        .children()
        .first()
        .empty()
        .append(jobCards);
    })
    .catch(error => {
      $(`.error-div[${widgetAttr}]`).removeClass("d-none");
      console.error(error);
      throw error;
    })
    .finally(() => {
      $(`.loading-div[${widgetAttr}]`).addClass("d-none");
      $(`.refresh-btn[${widgetAttr}] i`).removeClass('refresh-spin');
    });
}

jQuery(() => {
  loadJobQueue();
  $(`.refresh-btn[${widgetAttr}]`).on('click', loadJobQueue);
});
