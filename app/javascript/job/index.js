import { pageConfigData, filesPath, jobApiPathUrl, jobPathUrl, nodePathUrl, username } from '../config.js';

import toastr from 'toastr';

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
    return $("<span>").text("-");
  }
  const efficiency = (parseFloat(value) * 100).toFixed(2);  // Convert to percentage and format to 2 decimal places
  return $("<span>").text(`${efficiency}%`);
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

function createTimeDisplay(seconds) {
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

  const $timeSpan = $("<span>", {
    "data-bs-toggle": "tooltip",
    "title": rawFormat,
  }).css("border-bottom", ".15rem dotted var(--bs-secondary)")
    .text(parts.join(' '));

  return $timeSpan;

  // return {
  //   formatted: parts.join(' '),
  //   raw: rawFormat
  // };
}

function renderFileTabContent(parentDivId, iconClasses, filepath, fileContent) {
  const $contentDiv = $(`#${parentDivId}`).empty();
  const splitFilepath = filepath.split("/");
  const filepathDir = splitFilepath.slice(0, -1).join("/");
  const filename = splitFilepath.at(-1);
  const $externalLinkButton = $("<a>", {
    "class": "btn btn-sm btn-outline-secondary rounded-pill ms-auto",
    "target": "_blank",
    "href": filesPath() + filepath,
  })
    .append(
      $("<i>", { "class": "fas fa-external-link-alt me-2" }),
      "Open in new tab"
    );

  const $filepath = $("<div>", { "class": "flex-shrink-1 w-66 d-inline-flex me-2", "title": filepath, "aria-hidden": "true" })
    .append(
      $("<span>", { "class": "text-secondary overflow-hidden text-nowrap" })
        .css("direction", "rtl")
        .css("text-overflow", "ellipsis")
        .text(`${filepathDir}/`),
      $("<span>", { "class": "text-dark fw-bold" }).text(filename),
    );


  const $copyButton = $("<button>", { "class": "btn btn-outline-secondary", "data-clipboard": filepath, "title": "Copy full path" })
    .append($("<i>", { "class": "far fa-clipboard" }));

  const $header = $("<div>", { "class": "d-flex mb-2 align-items-baseline" }).append(
    $("<i>", { "class": `${iconClasses} me-2` }),
    $("<span>", { "class": "visually-hidden" }).text(filepath),
    $filepath,
    $copyButton,
    $externalLinkButton,
  );
  $contentDiv.append(
    $header,
    $("<pre>").append(fileContent),
  );

  // Initialize copy button
  $copyButton.on("click", function () {
    const clipboardData = $(this).data("clipboard");
    navigator.clipboard.writeText(clipboardData).then(() => {
      toastr.success(`Copied "${clipboardData}" to clipboard!`);
    }).error(() => {
      toastr.error(`Failed to copy "${clipboardData}".`);
    });
  });
}

function createNodeList(nodes) {
  if (nodes === null || nodes === undefined || !Array.isArray(nodes) || nodes.length === 0) return '';

  // Special case for "None assigned"
  if (nodes.length === 1 && nodes[0] === "None assigned") {
    return '';
  }

  return nodes.map(node =>
    $("<a>", { "class": "btn btn-outline-info", "href": nodePathUrl(node) }).text(node)
  );
}

function toggleNodeList(button) {
  const resourcesCard = button.closest('.info-card-body');
  const nodeList = resourcesCard.querySelector('.nodelist');
  const isExpanded = nodeList.classList.toggle('expanded');
  button.innerHTML = `<i class="fas fa-caret-${isExpanded ? 'up' : 'down'}"></i>`;
}

function getState(data) {
  if (typeof data.State !== "object") {
    return data.State;
  }
  const firstNonNullState = Object.values(data.State).find(state => state !== null);
  return firstNonNullState || defaultValue;
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

const CANCELABLE_STATES = ['PENDING', 'RUNNING', 'REQUEUED', 'SUSPENDED'];
function canCancelJob(jobData) {
  const jobState = getState(jobData).split(" ")[0].toUpperCase() || 'UNKNOWN';
  const jobUser = jobData.User.split('(')[0].trim(); // Get username without parenthetical ID
  return (jobUser === username() && CANCELABLE_STATES.includes(jobState));
}

function loadFile(filepath, tabId) {
  if (!filepath) {
    return;
  }

  // Add tail parameter to request last 1000 lines
  const url = new URL(filesPath() + filepath, window.location.origin);
  url.searchParams.append('tail', '1000');

  fetch(url, { headers: { "Accept": "application/json" }, redirect: "manual" })
    .then(response => response.json())
    .then(data => {
      if (data.error_message) {
        throw new Error(data.error_message)
      }

      $(`#${tabId}-tab`).removeClass("d-none");

      renderFileTabContent(`${tabId}-content`, "fas fa-file-alt text-info", filepath, data.content);
      return;
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
      $(`${tabId}-tab`).addClass("d-none");
      console.error('Error:', error);
      throw error;
    });
}

function getTimelineInfo(data) {
  const timelineInfo = {
    progress: 0,
    currentPoint: null,
    progressColor: '',
  };
  if (!data.Submit) {
    return timelineInfo;
  }

  const jobState = getState(data);
  timelineInfo.progressColor = `var(--job-state-${jobState.split(" ")[0].toLowerCase()}-bg)`;

  const now = Math.floor(Date.now() / 1000);
  const hasReachedPoint = (timestamp) => timestamp && timestamp <= now;

  if (hasReachedPoint(data.End)) {
    timelineInfo.currentPoint = 'end';
    timelineInfo.progress = 100;
  } else if (hasReachedPoint(data.Start)) {
    timelineInfo.currentPoint = 'start';
    timelineInfo.progress = 62.5;
    if (jobState === 'RUNNING' && data.Timelimit) {
      const elapsed = now - data.Start;
      const timelimit = parseInt(data.Timelimit);
      if (timelimit > 0) {
        const progress = Math.min((elapsed / timelimit) * 25, 25);
        timelineInfo.progress += progress;
      }
    }
  } else if (hasReachedPoint(data.Eligible)) {
    timelineInfo.currentPoint = 'eligible';
    timelineInfo.progress = 37.5;
  } else if (hasReachedPoint(data.Submit)) {
    timelineInfo.currentPoint = 'submit';
    timelineInfo.progress = 12.5;
  }
  return timelineInfo;
}

function createTimelinePoint(label, time, reached, current, progressColor) {
  const $point = $("<div>", {
    "class": `timeline-point${reached ? " reached" : ""}${current ? " current" : ""}`,
    "style": `--point-color: ${progressColor}`,
  }).append($("<div>", { "class": "timeline-point-marker" }))
    .append($("<div>", { "class": "timeline-point-label" }).text(label))
    .append($("<div>", { "class": "timeline-point-time" }).html(formatDateTime(time)));
  return $point;
}

function renderTimeline(data) {
  const info = getTimelineInfo(data);
  const $timeline = $(".timeline").empty();
  const $timelineProgress = $("<div>", { "class": "timeline-progress" });

  $timelineProgress.css({ "width": `${info.progress}%`, "background": info.progressColor });
  $timeline.append(
    $timelineProgress,
    createTimelinePoint("Submit", data.Submit, info.progress >= 12.5, info.currentPoint === "submit", info.progressColor),
    createTimelinePoint("Eligible", data.Eligible, info.progress >= 37.5, info.currentPoint === "eligible", info.progressColor),
    createTimelinePoint("Start", data.Start, info.progress >= 62.5, info.currentPoint === "start", info.progressColor),
    createTimelinePoint("End", data.End, info.progress >= 100, info.currentPoint === "end", info.progressColor),
  )
}

function createOverviewCard(iconClasses, title, bodyContent) {
  const $cardHeader = $("<div>", { "class": "card-header" })
    .append(
      $("<i>", { "class": `${iconClasses} me-2` }),
      title,
    );

  const $cardBody = $("<div>", { "class": "card-body container" });
  const $bodyRowCols = $("<div>", { "class": "row row-cols-2 gy-3" });
  for (const [key, content] of Object.entries(bodyContent)) {
    $bodyRowCols.append(
      $("<div>", { "class": "col-6 text-secondary" }).text(key),
      $("<div>", { "class": "col-6" }).append(content),
    );
  }
  $cardBody.append($bodyRowCols);

  const $card = $("<div>", { "class": "col" }).append(
    $("<div>", { "class": "card h-100" }).append(
      $cardHeader,
      $cardBody
    ));

  return $card;
}

function renderOverview(data) {
  const $jobInfoCard = createOverviewCard(
    "fas fa-info-circle text-info",
    "Job Information",
    {
      "Name": data.JobName,
      "User": data.User.split("(")[0],
      "Account": data.Account,
      "Partition": data.Partition,
      "QOS": data.QOS,
    });
  const nodelist = createNodeList(data.NodeList);
  const $nodelistToggleBtn = nodelist === "" ? "" : $("<button>", { "class": "ms-2 btn btn-outline-secondary btn-sm" }).append($("<i>", { "class": "fas fa-caret-right" }));
  const $resourcesCard = createOverviewCard(
    "fas fa-microchip text-body-secondary",
    "Resources",
    {
      "CPUs": data.NCPUS,
      "Memory": formatMemory(data.ReqMem),
      "Nodes": [data.NNodes, $nodelistToggleBtn],
    });
  if (nodelist !== "") {
    $resourcesCard.find(".card-body").first().append(
      $("<div>", { "id": "nodelist", "class": "d-none d-flex flex-wrap gap-2 mt-2" }).append(nodelist)
    );
  }
  const $timeCard = createOverviewCard(
    "fas fa-clock text-warning",
    "Time",
    {
      "Wall Time": createTimeDisplay(data.Elapsed),
      "Time Limit": createTimeDisplay(data.Timelimit),
      "CPU Time": createTimeDisplay(data.TotalCPU),
    });
  const $efficiencyCard = createOverviewCard(
    "fas fa-chart-line text-success",
    "Efficiency",
    {
      "CPU": formatEfficiency(data.cpu_efficiency),
      "Memory": formatEfficiency(data.memory_efficiency),
      "Time": formatEfficiency(data.time_efficiency),
    });


  const overviewContainer = $("#overview-content").children().first();
  overviewContainer.empty();
  overviewContainer.append(
    $jobInfoCard,
    $resourcesCard,
    $timeCard,
    $efficiencyCard,
  );

  // bind toggle nodelist button click
  if ($nodelistToggleBtn !== "") {
    $nodelistToggleBtn.on("click", function () {
      const $nodelist = $("#nodelist")
      const $icon = $(this).children("i").first()
      if ($nodelist.hasClass("d-none")) {
        // show
        $nodelist.removeClass("d-none");
        $icon.removeClass("fa-caret-right");
        $icon.addClass("fa-caret-down");
      } else {
        // hide
        $nodelist.addClass("d-none");
        $icon.addClass("fa-caret-right");
        $icon.removeClass("fa-caret-down");
      }
    });
  }

}

function renderJobData(data) {
  // Store current tab state before rendering
  const activeTabId = $('.nav-tabs .nav-link.active').attr('href') || '#info';

  const jobState = getState(data) || 'UNKNOWN';

  // Add auto-refresh for COMPLETING state
  if (jobState === 'COMPLETING') {
    setTimeout(() => loadJobData(), 3000);
  }

  // Render job state
  const stateColors = getJobStateColor(jobState);
  const stateDescription = getStateDescription(jobState, data.state_reason);
  $("#jobState > .badge").first()
    .attr("title", stateDescription || "")
    .attr("data-job-state", jobState.split(" ")[0].toLowerCase())
    .text(jobState);
  if (data.Reason) {
    $("#jobState").children().removeClass("d-none");
    $("#jobState > .badge").last()
      .attr("title", SIMPLE_JOB_REASON_CODES[data.Reason] || JOB_REASON_CODES[data.Reason] || '')
      .text(data.Reason);
  }
  renderTimeline(data);
  renderOverview(data);
  $("cancelJobBtn").parent().toggleClass("d-none", !canCancelJob(data));
}

function loadJobData() {
  $('.refresh-btn i').addClass('refresh-spin');

  fetch(jobApiPathUrl(cluster(), jobId()), { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      renderJobData(data);

      loadFile(data.StdOut, 'output');
      loadFile(data.StdErr, 'error');

      // Re-initialize tooltips after any dynamic updates
      $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip({
        trigger: 'hover',
        container: 'body',
        boundary: 'window',
        animation: false
      });
      $(".card-body").removeClass("d-none");
    }).catch(error => {
      $(".card-body").addClass("d-none");
      $(".error-div").removeClass("d-none");
      console.error('Error:', error);
      throw error;
    }).finally(() => {
      $(".loading-div").addClass("d-none");
      $('.refresh-btn i').removeClass('refresh-spin');
    });
}

// Initialize tooltips on page load
jQuery(() => {
  // Global default toastr options
  toastr.options.closeButton = false;
  toastr.options.debug = false;
  toastr.options.newestOnTop = false;
  toastr.options.progressBar = false;
  toastr.options.positionClass = "toast-top-right";
  toastr.options.preventDuplicates = true;
  toastr.options.onclick = null;
  toastr.options.showDuration = "300";
  toastr.options.hideDuration = "1000";
  toastr.options.timeOut = "5000";
  toastr.options.extendedTimeOut = "1000";
  toastr.options.showEasing = "swing";
  toastr.options.hideEasing = "linear";
  toastr.options.showMethod = "fadeIn";
  toastr.options.hideMethod = "fadeOut";

  $('[data-bs-toggle="tooltip"]').tooltip({
    trigger: 'hover',
    container: 'body'
  });
  loadJobData();

  // Bind refresh button
  $("button.refresh-btn").on("click", loadJobData);
  $("#confirmCancelJob").on("click", confirmCancelJob);
});

function confirmCancelJob() {
  $("#cancelJobModal").modal('hide');

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
      toastr.success(data.message || 'Job cancelled successfully');
      loadJobData();
    })
    .catch(error => {
      toastr.error(error.message || 'Failed to cancel job');
    });
}
