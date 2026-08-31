import { pageConfigData, filesPath, jobApiPathUrl, jobPathUrl, nodePathUrl, username } from './config.js';

const jobId = () => { return pageConfigData()["jobId"] };
const cluster = () => { return pageConfigData()["cluster"] };

function formatMemory(memStr) {
  if (!memStr || memStr === 'N/A' || memStr === null) return '';

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

function getJobStateColor(state) {
  // Get first word of state by splitting on underscore or space and taking first element
  state = state.split(" ")[0].toUpperCase();
  const stateColors = JOB_STATE_COLORS[state];
  if (stateColors) {
    return {
      bg: stateColors.bg,
      fg: stateColors.fg
    };
  }
  // Default colors if state not found - using a distinctive purple shade
  return {
    bg: '#d3d3d3', // Light gray
    fg: '#000000'  // White text for contrast
  };
}

function getStateDescription(state, reason) {
  // Get first word of state by splitting on underscore or space and taking first element
  state = state.split(" ")[0].toUpperCase();
  let description = SIMPLE_JOB_STATE_CODES[state] || JOB_STATE_CODES[state];

  if (!description) return null;

  if (reason) {
    const reasonDesc = SIMPLE_JOB_REASON_CODES[reason] || JOB_REASON_CODES[reason];
    if (reasonDesc) {
      description += ` (${reasonDesc})`;
    }
  }

  return description;
}

function formatEfficiency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '<span style="color: #64748b;">-</span>';
  }

  const efficiency = (parseFloat(value) * 100).toFixed(2);  // Convert to percentage and format to 2 decimal places
  let color;

  if (efficiency >= 75) {
    color = '#28a745';  // Green for good efficiency
  } else if (efficiency >= 50) {
    color = '#ffc107';  // Yellow for moderate efficiency
  } else {
    color = '#dc3545';  // Red for poor efficiency
  }

  return `<span style="color: ${color}; font-weight: 500;">${efficiency}%</span>`;
}

function formatDateTime(epochSeconds) {
  if (epochSeconds === null || epochSeconds === undefined) return '';

  try {
    const date = new Date(epochSeconds * 1000); // Convert epoch seconds to milliseconds
    if (isNaN(date.getTime())) return '';

    // Format date as MM/DD/YY
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });

    // Format time as HH:mm:ss
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });

    const formattedDate = dateFormatter.format(date);
    const timeStr = timeFormatter.format(date);

    // Split the time string into time and timezone
    const [time, timezone] = timeStr.split(' ');

    return `${formattedDate}<span class="separator d-none d-md-inline">, </span><span class="d-md-none"> </span><span class="text-nowrap">${time}</span> <span class="text-nowrap">${timezone}</span>`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
}

function format_time_display(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return { formatted: '', raw: '' };

  // Convert to whole seconds
  const totalSeconds = Math.floor(seconds);

  // Calculate hours, minutes, seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  // Format HH:MM:SS for tooltip
  const rawFormat = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    remainingSeconds.toString().padStart(2, '0')
  ].join(':');

  // Format display with abbreviations, skipping zero values
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} hr`);
  }

  // Only include minutes if:
  // 1. Minutes are non-zero, or
  // 2. We have hours AND seconds (need minutes as separator)
  if (minutes > 0 || (hours > 0 && remainingSeconds > 0)) {
    parts.push(`${minutes} m`);
  }

  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} s`);
  }

  return {
    formatted: parts.join(' '),
    raw: rawFormat
  };
}

function createNodeList(nodes) {
  if (nodes === null || nodes === undefined || !Array.isArray(nodes) || nodes.length === 0) return '';

  // Special case for "None assigned"
  if (nodes.length === 1 && nodes[0] === "None assigned") {
    return '';
  }

  return nodes.map(node => `
    <a href="${nodePathUrl(node)}"
      class="node-link">
      ${node}
    </a>
  `).join('');
}

function toggleNodeList(button) {
  const resourcesCard = button.closest('.info-card-body');
  const nodeList = resourcesCard.querySelector('.nodelist');
  const isExpanded = nodeList.classList.toggle('expanded');
  button.innerHTML = `<i class="fas fa-caret-${isExpanded ? 'up' : 'down'}"></i>`;
}

function get(data, key, defaultValue = '') {
  if (!data || !data.hasOwnProperty(key) || data[key] === null || data[key] === '' || data[key] === 'Unknown') {
    return defaultValue;
  }

  // Special handling for User field to remove parenthetical user ID
  if (key === 'User') {
    const userMatch = data[key].match(/^([^(]+)/);
    if (userMatch) {
      return userMatch[1].trim();
    }
  }

  // Handle case where value is an object (like State or steps)
  if (typeof data[key] === 'object' && data[key] !== null) {
    // If it's an empty object, return default
    if (Object.keys(data[key]).length === 0) {
      return defaultValue;
    }
    // For State object, return the first non-null value
    if (key === 'State') {
      const firstNonNullState = Object.values(data[key]).find(state => state !== null);
      return firstNonNullState || defaultValue;
    }
  }
  return data[key];
}

function loadFile(data, tabId, dataKey) {
  if (!get(data, dataKey)) {
    return;
  }

  const tab = document.getElementById(tabId);

  const content = tab.querySelector('.output-content');
  const loadingPlaceholder = content.querySelector('.loading-placeholder');
  const textContainer = content.querySelector('.output-text-container');

  // Show loading state
  loadingPlaceholder.classList.remove('d-none');
  textContainer.classList.add('d-none');

  // Add tail parameter to request last 1000 lines
  const filePath = get(data, dataKey);
  const url = new URL(filesPath() + filePath, window.location.origin);
  url.searchParams.append('tail', '1000');

  fetch(url)
    .then(response => {
      if (response.status === 403) {
        throw new Error('Access Denied');
      } else if (response.status === 404) {
        throw new Error('File Not Found');
      } else if (!response.ok) {
        throw new Error('Error Loading File');
      }
      return response.json();
    })
    .then(data => {
      // Split content into lines without filtering
      let lines = data.content.split('\n');

      // Add truncation message if we received exactly 1000 lines and there are more lines
      if (lines.length === 1000 && data.total_lines > 1000) {
        lines.unshift(`--- Output truncated. Showing last 1000 lines (${data.start_line}-${data.total_lines}) ---`);
      }

      // Clear previous content
      textContainer.innerHTML = '';

      // Create pre element for the output
      const pre = document.createElement('pre');
      pre.className = 'output-text';

      // Calculate the number of digits in the largest line number
      const maxLineNumber = data.total_lines;
      const numDigits = maxLineNumber.toString().length;

      // Add a CSS variable to the pre element to store the character width
      pre.style.setProperty('--line-number-chars', numDigits);

      lines.forEach((line, index) => {
        const lineDiv = document.createElement('div');

        if (index === 0 && line.startsWith('--- Output truncated')) {
          lineDiv.className = 'output-line truncation-message';
          const lineContent = document.createElement('span');
          lineContent.className = 'line-content';
          lineContent.textContent = line;
          lineDiv.appendChild(lineContent);
        } else {
          lineDiv.className = 'output-line';
          const lineNumber = document.createElement('span');
          lineNumber.className = 'line-number';
          const actualLineNumber = data.start_line + (index - (lines[0].startsWith('--- Output truncated') ? 1 : 0));
          // Pad the line number with spaces to match the maximum width
          lineNumber.textContent = actualLineNumber.toString().padStart(numDigits, ' ');

          const lineContent = document.createElement('span');
          lineContent.className = 'line-content';
          lineContent.textContent = line;

          lineDiv.appendChild(lineNumber);
          lineDiv.appendChild(lineContent);
        }

        pre.appendChild(lineDiv);
      });

      textContainer.appendChild(pre);

      // Show content
      textContainer.classList.remove('d-none');
      loadingPlaceholder.classList.add('d-none');

      // Initial scroll to bottom
      textContainer.scrollTo({
        top: textContainer.scrollHeight,
        behavior: 'smooth'
      });

      // Remove any existing event listeners
      $(`#${tabId}-tab`).off('shown.bs.tab.initial-scroll');

      // Only add the event listener if we're not currently on this tab
      if (!$(`#${tabId}-tab`).hasClass('active')) {
        $(`#${tabId}-tab`).one('shown.bs.tab.initial-scroll', function (e) {
          textContainer.scrollTo({
            top: textContainer.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    })
    .catch(error => {
      const errorDescriptions = {
        'File Not Found': 'File not found',
        'Access Denied': 'You do not have permission to view this file',
        'Error Loading File': 'Error loading file'
      };
      content.innerHTML = `
        <div class="d-flex flex-column align-items-center text-center p-4 m-3 bg-light rounded-3 border">
          <div class="d-flex align-items-center justify-content-center bg-danger-light rounded p-2 mb-2">
            <i class="fas fa-exclamation-circle text-danger fa-3x"></i>
          </div>
          <h5 class="fw-bold text-dark mb-2">${error.message}</h5>
          <p class="text-secondary mb-0">${errorDescriptions[error.message] || 'Error loading file'}</p>
        </div>
      `;
    });
}

function renderJobData(data) {
  // Store current tab state before rendering
  const activeTabId = $('.nav-tabs .nav-link.active').attr('href') || '#info';

  const jobState = get(data, 'State', 'UNKNOWN');

  // Add auto-refresh for COMPLETING state
  if (jobState === 'COMPLETING') {
    setTimeout(() => loadJobData(), 3000);
  }

  const stateColors = getJobStateColor(jobState);
  const stateDescription = getStateDescription(jobState, data.state_reason);

  const submitTime = get(data, 'Submit');
  const eligibleTime = get(data, 'Eligible');
  const startTime = get(data, 'Start');
  const endTime = get(data, 'End');

  // Calculate timeline progress
  let timelineProgress = 0;
  let currentPoint = null;
  let baseProgress = 0;
  let progressColor = '';

  if (submitTime) {
    // Get current Unix timestamp in seconds
    const now = Math.floor(Date.now() / 1000);
    const submit = submitTime;    // Already in epoch seconds
    const eligible = eligibleTime;
    const start = startTime;
    const end = endTime;

    // Reset progress and current point
    timelineProgress = 0;
    currentPoint = null;
    baseProgress = 0;

    // Helper function to check if a timestamp exists and is in the past
    const isReachedPoint = (timestamp) => timestamp && timestamp <= now;

    // Check each point in sequence and set the last valid one as current
    if (isReachedPoint(submit)) {
      timelineProgress = 25;
      currentPoint = 'submit';
      baseProgress = 25;
      progressColor = getJobStateColor(jobState).bg;
    }

    if (isReachedPoint(eligible)) {
      timelineProgress = 50;
      currentPoint = 'eligible';
      baseProgress = 50;
      progressColor = getJobStateColor(jobState).bg;
    }

    if (isReachedPoint(start)) {
      timelineProgress = 75;
      currentPoint = 'start';
      baseProgress = 75;
      progressColor = getJobStateColor(jobState).bg;

      // For running jobs, calculate progress between start and time limit
      if (jobState === 'RUNNING') {
        const elapsed = now - start;
        const timeLimit = get(data, 'Timelimit');

        if (timeLimit) {
          // timeLimit is already in seconds
          const timeLimitSeconds = parseInt(timeLimit);

          if (timeLimitSeconds > 0) {
            const progress = Math.min((elapsed / timeLimitSeconds) * 25, 25);
            timelineProgress = 75 + progress;
          }
        }
      }
    }

    if (isReachedPoint(end)) {
      timelineProgress = 100;
      currentPoint = 'end';
      baseProgress = 100;
      progressColor = getJobStateColor(jobState).bg;
    }

    // Add a small extension past the current checkpoint (unless we're at 100%)
    if (baseProgress < 100) {
      timelineProgress = Math.min(baseProgress + 5, timelineProgress);
    }

    // Validate timestamps are in chronological order
    if (submit > eligible || eligible > start || start > end) {
      console.warn('Timeline timestamps are not in chronological order');
    }
  }

  const timelineHtml = `
    <div class="timeline-container mb-4">
      <div class="timeline">
        <div class="timeline-progress" style="width: ${timelineProgress}%; background: ${progressColor}"></div>
        
        <div class="timeline-point ${timelineProgress >= 25 ? 'reached' : ''} ${currentPoint === 'submit' ? 'current' : ''}"
            style="--point-color: ${progressColor}; 
                   --point-shadow: ${progressColor}40;
                   --point-shadow-light: ${progressColor}30;
                   --point-shadow-lighter: ${progressColor}20;
                   --point-shadow-lightest: ${progressColor}10;">
          <div class="timeline-point-marker"></div>
          <div class="timeline-point-label">Submit</div>
          <div class="timeline-point-time">
            ${get(data, 'Submit') ? `
              ${formatDateTime(get(data, 'Submit', ''))}
            ` : ''}
          </div>
        </div>
        
        <div class="timeline-point ${timelineProgress >= 50 ? 'reached' : ''} ${currentPoint === 'eligible' ? 'current' : ''}"
            style="--point-color: ${progressColor}; 
                   --point-shadow: ${progressColor}40;
                   --point-shadow-light: ${progressColor}30;
                   --point-shadow-lighter: ${progressColor}20;
                   --point-shadow-lightest: ${progressColor}10;">
          <div class="timeline-point-marker"></div>
          <div class="timeline-point-label">Eligible</div>
          <div class="timeline-point-time">
            ${get(data, 'Eligible') ? `
              ${formatDateTime(get(data, 'Eligible', ''))}
            ` : ''}
          </div>
        </div>
        
        <div class="timeline-point ${timelineProgress >= 75 ? 'reached' : ''} ${currentPoint === 'start' ? 'current' : ''}"
            style="--point-color: ${progressColor}; 
                   --point-shadow: ${progressColor}40;
                   --point-shadow-light: ${progressColor}30;
                   --point-shadow-lighter: ${progressColor}20;
                   --point-shadow-lightest: ${progressColor}10;">
          <div class="timeline-point-marker"></div>
          <div class="timeline-point-label">Start</div>
          <div class="timeline-point-time">
            ${get(data, 'Start') ? `
              ${formatDateTime(get(data, 'Start', ''))}
            ` : ''}
          </div>
        </div>
        
        <div class="timeline-point ${timelineProgress >= 100 ? 'reached' : ''} ${currentPoint === 'end' ? 'current' : ''}"
            style="--point-color: ${progressColor}; 
                   --point-shadow: ${progressColor}40;
                   --point-shadow-light: ${progressColor}30;
                   --point-shadow-lighter: ${progressColor}20;
                   --point-shadow-lightest: ${progressColor}10;">
          <div class="timeline-point-marker"></div>
          <div class="timeline-point-label">End</div>
          <div class="timeline-point-time">
            ${get(data, 'End') ? `
              ${formatDateTime(get(data, 'End', ''))}
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // New tabs HTML structure
  const tabsHtml = `
    <ul class="nav nav-tabs mb-3" id="jobTabs" role="tablist">
      <li class="nav-item">
        <a class="nav-link ${activeTabId === '#info' ? 'active' : ''}" id="info-tab" data-bs-toggle="tab" href="#info" role="tab">
          <i class="fas fa-info-circle me-2"></i>Overview
        </a>
      </li>
      ${get(data, 'SessionId') ? `
        <li class="nav-item">
          <a class="nav-link ${activeTabId === '#session' ? 'active' : ''}" id="session-tab" data-bs-toggle="tab" href="#session" role="tab">
            <i class="fas fa-desktop me-2"></i>Session
          </a>
        </li>
      ` : ''}
      ${get(data, 'JobArray') && Array.isArray(data.JobArray) && data.JobArray.length > 0 ? `
        <li class="nav-item">
          <a class="nav-link ${activeTabId === '#tasks' ? 'active' : ''}" id="tasks-tab" data-bs-toggle="tab" href="#tasks" role="tab">
            <i class="fas fa-layer-group me-2"></i>Job Array
          </a>
        </li>
      ` : ''}
      ${get(data, 'StdOut') ? `
        <li class="nav-item">
          <a class="nav-link ${activeTabId === '#output' ? 'active' : ''}" id="output-tab" data-bs-toggle="tab" href="#output" role="tab">
            <i class="fas fa-terminal me-2"></i>Output
          </a>
        </li>
      ` : ''}
      ${get(data, 'StdErr') ? `
        <li class="nav-item">
          <a class="nav-link ${activeTabId === '#error' ? 'active' : ''}" id="error-tab" data-bs-toggle="tab" href="#error" role="tab">
            <i class="fas fa-exclamation-triangle me-2"></i>Error
          </a>
        </li>
      ` : ''}
    </ul>
    
    <div class="tab-content" id="jobTabContent">
      <div class="tab-pane fade ${activeTabId === '#info' ? 'show active' : ''}" id="info" role="tabpanel">
        <div class="job-card-grid">
          <!-- Job Information Card -->
          <div class="job-card-container">
            <div class="info-card">
              <div class="info-card-header py-4 px-4 border-bottom">
                <i class="fas fa-info-circle text-primary me-2"></i>
                Job Information
              </div>
              <div class="info-card-body p-4">
                <div class="info-item">
                  <span class="info-label">Name</span>
                  <span class="info-value">${get(data, 'JobName')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">User</span>
                  <span class="info-value">${get(data, 'User')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Account</span>
                  <span class="info-value">${get(data, 'Account')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Partition</span>
                  <span class="info-value">${get(data, 'Partition')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">QOS</span>
                  <span class="info-value">${get(data, 'QOS')}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Resources Card -->
          <div class="job-card-container">
            <div class="info-card">
              <div class="info-card-header py-4 px-4 border-bottom">
                <i class="fas fa-microchip text-success me-2"></i>
                Resources
              </div>
              <div class="info-card-body p-4">
                <div class="info-item">
                  <span class="info-label">CPUs</span>
                  <span class="info-value">${get(data, 'NCPUS')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Nodes</span>
                  <span class="info-value d-flex align-items-center">
                    ${get(data, 'NNodes')}
                    ${data.NodeList && data.NodeList.length > 0 && data.NodeList[0] !== "None assigned" ? `
                      <button class="nodelist-toggle ms-2" type="button" data-bs-toggle="collapse" data-bs-target="#nodelist" aria-expanded="false" aria-controls="nodelist">
                        <i class="fas fa-caret-down"></i>
                      </button>
                    ` : ''}
                  </span>
                </div>
                ${data.NodeList && data.NodeList.length > 0 && data.NodeList[0] !== "None assigned" ? `
                <div id="nodelist" class="collapse" style="margin-top: -0.75rem;">
                  ${createNodeList(data.NodeList)}
                </div>
                ` : ''}
                <div class="info-item">
                  <span class="info-label">Memory</span>
                  <span class="info-value">${formatMemory(get(data, 'ReqMem'))}</span>
                </div>
                ${data.AllocTRES && data.AllocTRES.includes('gres/gpu=') ? `
                <div class="info-item">
                  <span class="info-label">GPUs</span>
                  <span class="info-value">${data.AllocTRES.match(/gres\/gpu=(\d+)/)[1]}</span>
                </div>
                ` : ''}
                ${data.Partition && data.Partition === 'ai' ? `
                <div class="info-item">
                  <span class="info-label duration-tooltip" data-bs-toggle="tooltip" title="GPU Hours">GPU Hours</span>
                  <span class="info-value">
                    <span class="text-nowrap">${Number(get(data, 'UsedGPUHours', '0')).toFixed(2)} used</span> / 
                    <span class="text-nowrap">${Number(get(data, 'TotalGPUHours', '0')).toFixed(2)} reserved</span>
                  </span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Time Card -->
          <div class="job-card-container">
            <div class="info-card">
              <div class="info-card-header py-4 px-4 border-bottom">
                <i class="fas fa-clock text-warning me-2"></i>
                Time
              </div>
              <div class="info-card-body p-4">
                <div class="info-item">
                  <span class="info-label">Wall Time</span>
                  <span class="info-value duration-tooltip" 
                        data-bs-toggle="tooltip" 
                        data-bs-placement="right" 
                        title="${format_time_display(get(data, 'Elapsed')).raw}">
                    ${format_time_display(get(data, 'Elapsed')).formatted}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Time Limit</span>
                  <span class="info-value duration-tooltip" 
                        data-bs-toggle="tooltip" 
                        data-bs-placement="right" 
                        title="${format_time_display(get(data, 'Timelimit')).raw}">
                    ${format_time_display(get(data, 'Timelimit')).formatted}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">CPU Time</span>
                  <span class="info-value duration-tooltip" 
                        data-bs-toggle="tooltip" 
                        data-bs-placement="right" 
                        title="${format_time_display(get(data, 'TotalCPU')).raw}">
                    ${format_time_display(get(data, 'TotalCPU')).formatted}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Efficiency Card -->
          <div class="job-card-container">
            <div class="info-card">
              <div class="info-card-header py-4 px-4 border-bottom">
                <i class="fas fa-chart-line text-info me-2"></i>
                Efficiency
              </div>
              <div class="info-card-body p-4">
                <div class="info-item">
                  <span class="info-label">CPU</span>
                  <span class="info-value">${formatEfficiency(data.cpu_efficiency)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Memory</span>
                  <span class="info-value">${formatEfficiency(data.memory_efficiency)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Time</span>
                  <span class="info-value">${formatEfficiency(data.time_efficiency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${get(data, 'SessionId') ? `
        <div class="tab-pane fade ${activeTabId === '#session' ? 'show active' : ''}" id="session" role="tabpanel">
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">Session App</span>
              <span class="info-value">
                <a href="${get(data, 'SessionAppUrl')}" target="_blank">
                  ${get(data, 'SessionAppName')}
                </a>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Session ID</span>
              <span class="info-value">
                ${get(data, 'SessionId')}
              </span>
            </div>
            ${get(data, 'SessionPath') ? `
              <div class="info-item">
                <span class="info-label">Session Path</span>
                <span class="info-value font-monospace">
                  <a href="${filesPath() + get(data, 'SessionPath')}" class="text-primary">
                    ${get(data, 'SessionPath')}
                  </a>
                </span>
              </div>
            ` : ''}
            ${get(data, 'SessionConnection') ? `
              <hr>
              <div class="info-item d-block">
                ${get(data, 'SessionConnectionInfo')}
                ${get(data, 'SessionConnection')}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      ${get(data, 'JobArray') && Array.isArray(data.JobArray) && data.JobArray.length > 0 ? `
        <div class="tab-pane fade ${activeTabId === '#tasks' ? 'show active' : ''}" id="tasks" role="tabpanel">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th scope="col">Job Task ID</th>
                  <th scope="col">State</th>
                  <th scope="col">Nodes</th>
                  <th scope="col">Submit Time</th>
                  <th scope="col">Start Time</th>
                  <th scope="col">End Time</th>
                  <th scope="col">Elapsed</th>
                  <th scope="col">Exit Code</th>
                </tr>
              </thead>
              <tbody>
                ${data.JobArray.map(task => `
                  <tr>
                    <td>
                      <a href="${jobPathUrl(get(task, 'JobID'))}"
                         class="text-primary font-weight-medium">
                        ${get(task, 'JobID')}
                      </a>
                    </td>
                    <td>
                      <span class="badge rounded-pill duration-tooltip" 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="bottom"
                            data-bs-trigger="hover"
                            data-bs-container="body"
                            title="${getStateDescription(get(task, 'State'), get(task, 'Reason')) || ''}"
                            style="background-color: ${getJobStateColor(get(task, 'State')).bg}; 
                                   color: ${getJobStateColor(get(task, 'State')).fg};">
                        ${get(task, 'State')}
                      </span>
                    </td>
                    <td>
                      ${get(task, 'NodeList') && Array.isArray(task.NodeList) &&
      task.NodeList.length > 0 &&
      task.NodeList[0] !== "None assigned" ?
      task.NodeList.map(node => `
                            <a href="${nodePathUrl(node)}"
                               class="node-link">
                              ${node}
                            </a>
                          `).join('')
      : ''}
                    </td>
                    <td>${formatDateTime(get(task, 'Submit'))}</td>
                    <td>${formatDateTime(get(task, 'Start'))}</td>
                    <td>${formatDateTime(get(task, 'End'))}</td>
                    <td>
                      <span class="duration-tooltip" 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="bottom" 
                            title="${format_time_display(get(task, 'Elapsed')).raw}">
                        ${get(task, 'Elapsed') && get(task, 'Elapsed') !== '0' ?
      format_time_display(get(task, 'Elapsed')).formatted :
      ''}
                      </span>
                    </td>
                    <td>
                      <span class="font-monospace">${get(task, 'ExitCode')}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
      ${get(data, 'StdOut') ? `
        <div class="tab-pane fade ${activeTabId === '#output' ? 'show active' : ''}" id="output" role="tabpanel">
          <div class="output-container px-2">
            <div class="output-header d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center">
                <i class="fas fa-file-alt me-2 text-primary" style="font-size: 1.25rem;"></i>
                <h5 class="mb-0 text-muted">
                  ${(() => {
        const path = get(data, 'StdOut');
        const parts = path.split('/');
        const fileName = parts.pop();
        return `${parts.join('/')}/`
          + `<span class="text-dark fw-bolder" style="font-size: 1.2em; text-shadow: 0 0 0.5px currentColor;">${fileName}</span>`;
      })()}
                </h5>
              </div>
              <a href="${filesPath() + get(data, 'StdOut')}" 
                 class="btn btn-sm btn-outline-secondary rounded-pill ms-3 text-nowrap"
                 target="_blank">
                <i class="fas fa-external-link-alt"></i>
                <span class="d-none d-md-inline ms-1">Open in New Tab</span>
              </a>
            </div>
            <div class="mt-3">
              <div class="output-content position-relative border rounded bg-white">
                <div class="loading-placeholder">
                  <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5">
                    <div class="spinner-border text-secondary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2">Loading output file...</p>
                  </div>
                </div>
                <div class="output-text-container d-none">
                  <pre class="output-text"></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
      ${get(data, 'StdErr') ? `
        <div class="tab-pane fade ${activeTabId === '#error' ? 'show active' : ''}" id="error" role="tabpanel">
          <div class="output-container px-2">
            <div class="output-header d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center">
                <i class="fas fa-exclamation-triangle me-2 text-danger" style="font-size: 1.25rem;"></i>
                <h5 class="mb-0 text-muted">
                  ${(() => {
        const path = get(data, 'StdErr');
        const parts = path.split('/');
        const fileName = parts.pop();
        return `${parts.join('/')}/`
          + `<span class="text-dark fw-bolder" style="font-size: 1.2em; text-shadow: 0 0 0.5px currentColor;">${fileName}</span>`;
      })()}
                </h5>
              </div>
              <a href="${filesPath() + get(data, 'StdErr')}" 
                 class="btn btn-sm btn-outline-secondary rounded-pill ms-3 text-nowrap"
                 target="_blank">
                <i class="fas fa-external-link-alt"></i>
                <span class="d-none d-md-inline ms-1">Open in New Tab</span>
              </a>
            </div>
            <div class="mt-3">
              <div class="output-content position-relative border rounded bg-white">
                <div class="loading-placeholder">
                  <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5">
                    <div class="spinner-border text-secondary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mt-2">Loading error output...</p>
                  </div>
                </div>
                <div class="output-text-container d-none">
                  <pre class="output-text"></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Combine timeline and tabs HTML
  document.getElementById('job_content').innerHTML = timelineHtml + tabsHtml;

  // $(".nodelist-toggle").on('click', toggleNodeList($(this)));

  const stateBadgeHtml = `
    <span class="badge rounded-pill duration-tooltip ms-sm-3" 
          data-bs-toggle="tooltip" 
          data-bs-placement="bottom"
          title="${getStateDescription(jobState, data.state_reason) || ''}"
          style="background-color: ${stateColors.bg}; color: ${stateColors.fg};">
      ${jobState}
    </span>
    ${data.Reason ? `
      <div class="d-inline-block d-md-inline-flex align-items-center mx-2 my-1 my-md-0">
        <span class="text-dark text-nowrap" style="font-size: 1.1rem; font-weight: 500;">due to</span>
      </div>
      <span class="badge rounded-pill text-bg-light duration-tooltip"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            title="${SIMPLE_JOB_REASON_CODES[data.Reason] || JOB_REASON_CODES[data.Reason] || ''}">
        ${data.Reason}
      </span>
    ` : ''}
  `;

  document.getElementById('jobState').innerHTML = stateBadgeHtml;
  document.getElementById('jobStateDesktop').innerHTML = stateBadgeHtml;

  // Initialize all tooltips after content is rendered
  $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip({
    trigger: 'hover',
    container: 'body',
    boundary: 'window',
    animation: false
  });

  // Update cancel button visibility based on job state and ownership
  const cancelJobContainer = document.getElementById('cancel-job-container');
  const cancelableStates = ['PENDING', 'RUNNING', 'REQUEUED', 'SUSPENDED'];
  const jobUser = get(data, 'User', '').split('(')[0].trim(); // Get username without parenthetical ID
  const currentUser = username; // Get current user from Ruby

  if (cancelableStates.includes(jobState.split(" ")[0].toUpperCase()) && jobUser === currentUser) {
    cancelJobContainer.classList.remove('d-none');
    cancelJobContainer.classList.add('d-block');
  } else {
    cancelJobContainer.classList.remove('d-block');
    cancelJobContainer.classList.add('d-none');
  }
}

function loadJobData() {
  // Add spinning class to refresh icon
  $('.btn-outline-secondary .fa-sync-alt').addClass('fa-spin');

  fetch(jobApiPathUrl(cluster(), jobId()), { cache: "no-store" })
    .then(res => {
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderJobData(data);

      loadFile(data, 'output', 'StdOut');
      loadFile(data, 'error', 'StdErr');

      // Re-initialize tooltips after any dynamic updates
      $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip({
        trigger: 'hover',
        container: 'body',
        boundary: 'window',
        animation: false
      });
    })
    .catch(error => {
      const errorHtml = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5">
          <div class="text-danger mb-3">
            <i class="fas fa-exclamation-circle fa-2x"></i>
          </div>
          <h5 class="mb-2">Unable to Load Job Information</h5>
          <p class="text-muted small mb-3">${error.message}</p>
          <button class="btn btn-sm btn-outline-secondary rounded-pill shadow-sm">
            <i class="fas fa-sync-alt me-1"></i> Retry
          </button>
        </div>
      `;
      document.getElementById('job_content').innerHTML = errorHtml;
    })
    .finally(() => {
      // Remove spinning class when request completes
      $('.btn-outline-secondary .fa-sync-alt').on('click', loadJobData);
      $('.btn-outline-secondary .fa-sync-alt').removeClass('fa-spin');
    });
}

// Initialize tooltips on page load
jQuery(() => {
  $('.btn-outline-secondary .fa-sync-alt').on('click', loadJobData);
  $('[data-bs-toggle="tooltip"]').tooltip({
    trigger: 'hover',
    container: 'body'
  });
  loadJobData();
});

// Destroy tooltips before modal shows to prevent stuck tooltips
$('#cancelJobModal').on('show.bs.modal', function () {
  $('[data-bs-toggle="tooltip"]').tooltip('dispose');
});

// Re-initialize tooltips after modal is hidden
$('#cancelJobModal').on('hidden.bs.modal', function () {
  $('[data-bs-toggle="tooltip"]').tooltip({
    trigger: 'hover',
    container: 'body'
  });
});

function cancelJob() {
  const modal = document.getElementById('cancelJobModal');
  const keepRunningBtn = document.getElementById('keepRunningBtn');

  $(modal).modal({
    keyboard: true,
    backdrop: 'static',
    focus: false
  });

  // Show modal and handle focus
  $(modal).modal('show');
  setTimeout(() => keepRunningBtn.focus(), 150);
}

function confirmCancelJob() {
  const modal = document.getElementById('cancelJobModal');
  const cancelBtn = document.getElementById('cancelJobBtn');

  $(modal).modal('hide');
  setTimeout(() => cancelBtn.focus(), 150);

  const jobId = document.getElementById('jobId').textContent;

  fetch(cancelJobsApiPath(jobId()), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
    }
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      const toast = createToast('success', data.message || 'Job cancelled successfully');
      document.body.appendChild(toast);
      loadJobData();
    })
    .catch(error => {
      const errorMessage = error.message || 'Failed to cancel job';
      const toast = createToast('error', errorMessage);
      document.body.appendChild(toast);
    });
}

// Add event listener for modal close
$(document).ready(function () {
  const modal = document.getElementById('cancelJobModal');
  const cancelBtn = document.getElementById('cancelJobBtn');

  $(modal).on('hidden.bs.modal', function () {
    cancelBtn.focus();
  });
});

// Add toast notification helper
function createToast(type, message) {
  const toast = document.createElement('div');
  toast.className = `job-toast job-toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    </div>
  `;

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);

  return toast;
}
