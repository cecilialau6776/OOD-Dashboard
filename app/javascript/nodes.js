import { pageConfigData, jobPathUrl } from './config.js';


const nodeName = () => { return document.getElementById("page-data").dataset["nodeName"] };
const nodeApiUrl = (node_name) => { return pageConfigData().replace('__NAME__', node_name) };

function formatMemory(memInMB) {
  const mem = Number(memInMB);
  if (!mem || isNaN(mem)) return '0 MB';

  if (memInMB >= 1048576) {
    return `${(memInMB / 1048576).toFixed(2)} TB`;
  }
  if (memInMB >= 1024) {
    return `${(memInMB / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(memInMB)} MB`;
}

function getNodeColor(state) {
  if (state.includes('DOWN')) return '#dc3545';
  if (state.includes('DRAIN')) return '#ffc107';
  if (state.includes('MAINT')) return '#fd7e14';
  return '#28a745';
}

function getJobStateColor(state) {
  state = state.toUpperCase();
  const stateColors = JOB_STATE_COLORS[state];
  if (stateColors) {
    return {
      bg: stateColors.bg,
      fg: stateColors.fg
    };
  }
  // Default colors if state not found
  return {
    bg: '#f3f4f6',
    fg: '#374151'
  };
}

function formatJobMemory(memStr) {
  if (!memStr || memStr === 'N/A') return 'N/A';

  // Convert 'G', 'M', 'T' to 'GB', 'MB', 'TB'
  const match = memStr.match(/^(\d+(?:\.\d+)?)([GMTgmt])$/);
  if (!match) return memStr;

  const [, value, unit] = match;
  const unitMap = {
    'G': 'GB',
    'g': 'GB',
    'M': 'MB',
    'm': 'MB',
    'T': 'TB',
    't': 'TB'
  };

  return `${value} ${unitMap[unit] || unit}`;
}

function parseTRES(tres) {
  if (!tres) return {};

  const result = {};
  tres.split(',').forEach(item => {
    const [type, value] = item.split('=');
    result[type] = value;
  });
  return result;
}

function renderNodeData(data) {
  // Store current tab state before rendering
  const activeTabId = $('.nav-tabs .nav-link.active').attr('href') || '#jobs';

  // Helper function to safely get nested values
  const get = (obj, key, defaultValue = 'N/A') => {
    const value = obj.hasOwnProperty(key) ? obj[key] : defaultValue;
    // Handle special values
    if (['None', '(null)', 'N/A', 'Unknown'].includes(value)) return defaultValue;
    return value;
  };

  // Helper for date formatting
  const formatDate = (dateStr) => {
    if (!dateStr || ['None', 'N/A', 'Unknown'].includes(dateStr)) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const memTotal = Number(data.RealMemory || 0);
  const memAlloc = Number(data.AllocMem || 0);
  const cpuTotal = Number(data.CPUTot || data.CPUs || 0);
  const cpuAlloc = Number(data.CPUAlloc || 0);
  const gpuTotal = Number(data.gpu_info.total);
  const gpuAlloc = Number(data.gpu_info.allocated);
  const cpuUsagePercent = cpuTotal ? Math.round((cpuAlloc / cpuTotal) * 100) : 0;
  const gpuUsagePercent = gpuTotal != 0 ? Math.round((gpuAlloc / gpuTotal) * 100) : 0;
  const memUsagePercent = memTotal ? Math.round((memAlloc / memTotal) * 100) : 0;

  // CPU configuration
  const cpuDetails = [];
  if (data.CoresPerSocket) cpuDetails.push(`${data.CoresPerSocket} cores/socket`);
  if (data.Sockets) cpuDetails.push(`${data.Sockets} sockets`);
  if (data.ThreadsPerCore) cpuDetails.push(`${data.ThreadsPerCore} threads/core`);
  const cpuDetailsText = cpuDetails.length > 0 ? cpuDetails.join(', ') : 'N/A';

  // Handle powered down state
  const isPoweredDown = (data.State || '').includes('POWERED_DOWN');

  const jobRowHtml = job => {
    const colors = getJobStateColor(job.state || '');
    const stateDescription = SIMPLE_JOB_STATE_CODES[job.state] || JOB_STATE_CODES[job.state] || 'Unknown state';

    return `
      <tr>
        <td><a href="${jobPathUrl(job.id)}" class="job-id-link">${job.id}</a></td>
        <td>${job.name || 'N/A'}</td>
        <td>${job.user || 'N/A'}</td>
        <td>${job.partition || 'N/A'}</td>
        <td>
          <span class="badge rounded-pill has-tooltip" 
                data-bs-toggle="tooltip" 
                data-bs-title="${stateDescription}"
                style="background-color: ${colors.bg}; color: ${colors.fg}">
            ${job.state || 'N/A'}
          </span>
        </td>
        <td>${data.gpu_info ? (job.gpus || 'N/A') : (job.cpus || 'N/A')}</td>
        <td>${job.memory && job.memory.display !== 'N/A' ?
        `<span class="has-tooltip" data-bs-toggle="tooltip" data-bs-title="${job.memory.mb} MB">${job.memory.display}</span>` :
        'N/A'}</td>
        <td>${job.time || 'N/A'}</td>
        <td>${job.time_limit || 'N/A'}</td>
      </tr>
    `;
  };

  const jobCardHtml = job => {
    const colors = getJobStateColor(job.state || '');
    const stateDescription = SIMPLE_JOB_STATE_CODES[job.state] || JOB_STATE_CODES[job.state] || 'Unknown state';

    return `
      <a href="${jobPathUrl(job.id)}" class="job-card">
        <div class="job-card-header">
          <div class="job-id">
            <i class="fas fa-terminal text-muted me-1" aria-hidden="true"></i>
            <span class="job-id-text">${job.id}</span>
          </div>
          <div class="d-flex align-items-center">
            <span class="badge rounded-pill me-2 has-tooltip" 
                  data-bs-toggle="tooltip" 
                  data-bs-title="${stateDescription}"
                  style="background-color: ${colors.bg}; color: ${colors.fg}">
              ${job.state || 'N/A'}
            </span>
          </div>
        </div>
        <div class="job-card-body">
          <div class="job-info-row">
            <i class="fas fa-tag text-muted me-2"></i>
            <span class="job-name">${job.name || 'N/A'}</span>
          </div>
          <div class="job-info-row">
            <i class="fas fa-user text-muted me-2"></i>
            <span>${job.user || 'N/A'}</span>
          </div>
          <div class="job-info-row">
            <i class="fas fa-layer-group text-muted me-2"></i>
            <span>${job.partition || 'N/A'}</span>
          </div>
          <div class="job-info-row">
            <i class="fas fa-microchip text-muted me-2"></i>
            <div class="resource-info">
              <div class="resource-item">
                <span class="resource-label">${data.gpu_info ? 'GPUs:' : 'CPU Cores:'}</span>
                <span class="resource-value">${data.gpu_info ? (job.gpus || 'N/A') : (job.cpus || 'N/A')}</span>
              </div>
              <div class="resource-item">
                <span class="resource-label">Memory:</span>
                <span class="resource-value ${job.memory && job.memory.display !== 'N/A' ? 'has-tooltip' : ''}" 
                      ${job.memory && job.memory.display !== 'N/A' ? `data-toggle="tooltip" data-bs-title="${job.memory.mb} MB"` : ''}>
                  ${job.memory ? job.memory.display : 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <div class="job-info-row time-row">
            <i class="fas fa-clock text-muted me-2"></i>
            <div class="time-info">
              <div class="time-item">
                <span class="time-label">Runtime:</span>
                <span class="time-value" title="How long the job has been running">${job.time || 'N/A'}</span>
              </div>
              <div class="time-item">
                <span class="time-label">Time Limit:</span>
                <span class="time-value" title="Maximum allowed runtime">${job.time_limit || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </a>
    `;
  };

  const html = `
    <div class="row">
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-subtitle mb-3 text-muted">Status</h6>
            <div class="d-flex align-items-center mb-3">
              <div class="status-box me-2" style="background-color: ${getNodeColor(get(data, 'State', 'UNKNOWN'))}"></div>
              <h5 class="mb-0 status-text">${get(data, 'State')}</h5>
            </div>
            ${get(data, 'Reason') !== 'N/A' ? `<p class="text-muted mb-0">Reason: ${get(data, 'Reason')}</p>` : ''}
            <p class="text-muted mb-0">Last Active: ${formatDate(data.LastBusyTime)}</p>
            ${isPoweredDown ? '<p class="text-muted mb-0"><i class="fas fa-power-off me-1"></i>Powered Down</p>' : ''}
          </div>
        </div>
      </div>

      <div class="col-md-6 col-lg-8 mb-4">
        <div class="card h-100">
          <div class="card-body">
            <h6 class="card-subtitle mb-3 text-muted">Resource Usage</h6>
            <div class="row">
              <div class="col-sm-6 mb-3">
                <label class="d-flex justify-content-between mb-2">
                  <span>CPU Usage</span>
                  <span>${data.CPUAlloc || 0}/${data.CPUTot || data.CPUs || 0}</span>
                </label>
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar bg-success" 
                    role="progressbar" 
                    style="width: ${cpuUsagePercent}%"></div>
                </div>
                ${data.gpu_info.total != 0 ? `
                  <label class="d-flex justify-content-between mb-2">
                    <span>GPU Usage</span>
                    <span>${data.gpu_info.allocated}/${data.gpu_info.total}</span>
                  </label>
                  <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" 
                      role="progressbar" 
                      style="width: ${gpuUsagePercent}%"></div>
                  </div>
                ` : ''}
              </div>
              <div class="col-sm-6 mb-3">
                <label class="d-flex justify-content-between mb-2">
                  <span>CPU Memory Usage</span>
                  <span>${formatMemory(memAlloc)}/${formatMemory(memTotal)}</span>
                </label>
                <div class="progress" style="height: 8px;">
                  <div class="progress-bar bg-success" 
                       role="progressbar" 
                       style="width: ${memUsagePercent}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <!-- Single set of tabs for both desktop and mobile -->
            <ul class="nav nav-tabs modern-tabs" id="nodeTabs" role="tablist">
              <li class="nav-item">
                <a class="nav-link ${activeTabId === '#jobs' ? 'active' : ''}" id="jobs-tab" data-bs-toggle="tab" href="#jobs" role="tab">
                  <i class="fas fa-tasks me-2"></i>Running Jobs
                </a>
              </li>
            </ul>

            <div class="tab-content pt-4" id="nodeTabContent">
              <div class="tab-pane fade ${activeTabId === '#jobs' ? 'show active' : ''}" id="jobs" role="tabpanel">
                <!-- Desktop table view -->
                <div class="d-none d-md-block">
                  <div class="table-responsive">
                    <table class="table table-hover" id="jobsTable">
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Name</th>
                          <th>User</th>
                          <th>Partition</th>
                          <th>State</th>
                          <th>${data.gpu_info ? 'GPUs' : 'CPU Cores'}</th>
                          <th>Memory</th>
                          <th>Runtime</th>
                          <th>Time Limit</th>
                        </tr>
                      </thead>
                      <tbody>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Mobile cards view -->
                <div class="d-md-none">
                  <div id="jobCards">
                    <!-- Jobs cards will be inserted here -->
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  $("#node_content").html(html);

  // Update jobs table
  const jobsTableBody = document.querySelector('#jobsTable tbody');
  const jobCards = document.querySelector('#jobCards');


  if (data.jobs && data.jobs.length > 0) {
    $(jobsTableBody).html(data.jobs.map(jobRowHtml).join(''));
    $(jobCards).html(data.jobs.map(jobCardHtml).join(''));
  } else {
    // Show no jobs message for both views
    const noJobsMessage = `
      <tr>
        <td colspan="9" class="text-center py-5">
          <div class="empty-state">
            <div class="empty-state-icon mb-3">
              <i class="fas fa-tasks"></i>
            </div>
            <h5 class="text-muted mb-2">No Active Jobs</h5>
            <p class="text-muted small mb-0">There are no jobs currently running on this node</p>
          </div>
        </td>
      </tr>
    `;
    $(jobsTableBody).html(noJobsMessage);

    $(jobCards).html(`
      <div class="text-center text-muted py-4">
        <i class="fas fa-info-circle me-1"></i>
        No jobs currently running on this node
      </div>
    `);
  }
}

function loadNodeData() {
  // Add spinning class to refresh icon
  $('.btn-outline-secondary .fa-sync-alt').addClass('fa-spin');

  fetch(nodeApiUrl(nodeName()))
    .then(res => {
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderNodeData(data);
      // Re-initialize Bootstrap tabs
      $('#nodeTabs a').on('click', function (e) {
        e.preventDefault();
        $(this).tab('show');
      });

      // Re-initialize tooltips after content updates
      $('[data-bs-toggle="tooltip"]').tooltip('dispose'); // Remove any existing tooltips
      $('[data-bs-toggle="tooltip"]').tooltip({ boundary: 'window' });
      // $('[data-bs-toggle="tooltip"]').tooltip({
      //   placement: 'top',
      //   container: 'body',
      //   html: true,
      //   trigger: 'hover',
      //   boundary: 'window'
      // });

    })
    .catch(error => {
      const errorHtml = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5">
          <div class="text-danger mb-3">
            <i class="fas fa-exclamation-circle fa-2x"></i>
          </div>
          <h5 class="mb-2">Unable to Load Node Information</h5>
          <p class="text-muted small mb-3">${error.message}</p>
          <button class="btn btn-sm btn-outline-secondary rounded-pill shadow-sm refresh-button">
            <i class="fas fa-sync-alt me-1"></i> Retry
          </button>
        </div>
      `;
      document.getElementById('node_content').innerHTML = errorHtml;
    })
    .finally(() => {
      // Remove spinning class when request completes
      $('.btn-outline-secondary .fa-sync-alt').removeClass('fa-spin');
    });
}

// Initial load with loading animation
jQuery(() => {
  loadNodeData();
  $('.refresh-button').on('click', loadNodeData);
});

// Replace both tab change handlers with this updated one
$(document).on('shown.bs.tab', 'a[data-bs-toggle="tab"]', function (e) {
  const activeTabId = $(e.target).attr('href');

  // Update desktop tabs
  $('.nav-tabs .nav-link').removeClass('active');
  $(`.nav-tabs .nav-link[href="${activeTabId}"]`).addClass('active');

  // Update tab content
  $('.tab-pane').removeClass('show active');
  $(activeTabId).addClass('show active');
});

// Remove the window resize handler since we don't need it anymore
$(window).off('resize');
