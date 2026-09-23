import { analyticsPath } from "./config";

export function cssBadgeForState(state) {
  switch (state) {
    case 'completed':
      return 'bg-success';
    case 'running':
      return 'bg-primary'
    case 'queued':
      return 'bg-info';
    case 'queued_held':
      return 'bg-warning';
    case 'suspended':
      return 'bg-warning';
    default:
      return 'bg-warning';
  }
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function toHumanSize(number, precision = 2) {
  if (number === null) {
    return '-';
  } else {
    const unitIndex = number == 0 ? 0 : Math.floor(Math.log(number) / Math.log(1000));
    return `${((number / Math.pow(1000, unitIndex)).toFixed(precision))} ${['B', 'kB', 'MB', 'GB', 'TB', 'PB'][unitIndex]}`;
  }
}

export function startOfYear() {
  const now = new Date();
  const past = new Date();
  past.setDate(1);
  past.setMonth(0);
  past.setFullYear(now.getFullYear());
  return `${past.getFullYear()}-${past.getMonth() + 1}-${past.getDate()}`;
}

export function thirtyDaysAgo() {
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30);
  return `${past.getFullYear()}-${past.getMonth() + 1}-${past.getDate()}`;
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// the next two functions, using #full_page_spinner, are only used in sweet_alert.js
export function pageSpin() {
  const ele = document.getElementById('full_page_spinner');
  ele.classList.remove('d-none');
  ariaNotify('Loading.');
}

export function stopPageSpin() {
  const ele = document.getElementById('full_page_spinner');
  ele.classList.add('d-none');
  ariaNotify('Loading complete.');
}

// The next three functions use #full-page-spinner, and are used more widely
function showSpinner() {
  $('body').addClass('modal-open');
  $('#full-page-spinner').removeClass('d-none');
}

function hideSpinner() {
  $('body').removeClass('modal-open');
  $('#full-page-spinner').addClass('d-none');
}

export function bindFullPageSpinnerEvent() {
  $('.full-page-spinner').each((index, element) => {
    const $element = $(element);
    if ($element.is('a')) {
      $element.on('click', showSpinner);
    } else {
      $element.closest('form').on('submit', showSpinner);
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) hideSpinner();
  })
}

// open links in javascript and display an alert
export function openLinkInJs(event) {
  event.preventDefault();
  let href = event.target.href;

  // event.target could be a child of the anchor, so try that.
  if (href == null) {
    const closestAnchor = event.target.closest('a');
    if (closestAnchor.hasChildNodes(event.target)) {
      href = closestAnchor.href;
    } else {
      // event.target is not a child of an anhcor, so there's nothing to do.
      return;
    }
  }

  if (window.open(href) == null) {
    // link was not opened in new window, so display error msg to user
    const html = document.getElementById('js-alert-danger-template').innerHTML;
    const msg = "This link is configured to open in a new window, but it doesn't seem to have opened. " +
      "Please disable your popup blocker for this page and try again.";

    // replace message in alert and add to main div of layout
    const mainDiv = document.querySelectorAll('div[role="main"]')[0];
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML = html.split("ALERT_MSG").join(msg);
    mainDiv.prepend(alertDiv);
  }
}

// Sets a custom message for a generic ARIA live region
export function ariaNotify(message, interrupt = true) {
  const liveRegion = document.getElementById("aria_live_region");

  if (liveRegion) {
    if (interrupt) {
      liveRegion.textContent = message;
    }
    else {
      const messageBlock = document.createElement('p');
      messageBlock.textContent = message;
      liveRegion.appendChild(messageBlock);
    }
  }
}

// Push a notification to the user using the Notification API
export function pushNotify(message, options = {}) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(message, options);
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(message, options);
      }
    });
  }
}

// rearrange table header labels so button labels are not part of header
export function customizeTableHeaders(thead) {
  $(thead).find('th.dt-orderable-asc').each(function (_index, el) {
    const sortButton = $(el).find('span.dt-column-order');
    const ariaLabel = sortButton.attr('aria-label');
    $(el).attr('aria-label', ariaLabel).attr('tabindex', '0');
    sortButton.removeAttr('aria-label')
      .removeAttr('tabindex')
      .removeAttr('role')
      .attr('aria-hidden', 'true');
  });
}

// Store a boolean value in localStorage
export function storeBoolean(key, value) {
  localStorage.setItem(key, value ? 'true' : 'false');
}

// Retrieve a boolean value from localStorage
export function getBoolean(key) {
  return localStorage.getItem(key) === 'true';
}

// Helper method to set an element's innerHTML property
// and evaluate any <script> tags that may exist within it.
// Just setting innerHTML of an html element does not re-evaluate
// the <script> tags that it may hold.
export function setInnerHTML(element, html) {
  element.innerHTML = html;
  const scripts = Array.from(element.querySelectorAll("script"));

  scripts.forEach(currentElement => {
    const newElement = document.createElement("script");

    Array.from(currentElement.attributes).forEach(attr => {
      newElement.setAttribute(attr.name, attr.value);
    });

    const scriptText = document.createTextNode(currentElement.innerHTML);
    newElement.appendChild(scriptText);

    currentElement.parentNode.replaceChild(newElement, currentElement);
  });
}

// Helper method to report errors from the front end via AJAX
export function reportErrorForAnalytics(path, error) {
  // error - report back for analytics purposes
  const analyticsUrl = new URL(analyticsPath(path), document.location);
  analyticsUrl.searchParams.append('error', error);
  // Fire and Forget
  fetch(analyticsUrl);
}

// helper method to hide an element. Note that jQuery's hide()
// changes the inline style which may not do anything if the element
// already has a bootstrap display class like d-flex.
// target can be an id or an HTMLElement
export function hide(target) {
  const ele = typeof target === 'string' ? document.getElementById(target) : target;
  if (ele instanceof HTMLElement) {
    ele.classList.add('d-none');
  }
}

// helper method to show an element. Note that jQuery's show()
// changes the inline style which may not do anything if the element
// already has a bootstrap display class like d-flex.
// target can be an id or an HTMLElement
export function show(target) {
  const ele = typeof target === 'string' ? document.getElementById(target) : target;
  if (ele instanceof HTMLElement) {
    ele.classList.remove('d-none');
  }
}

export function startTimestampUpdater() {
  // Clear any existing interval
  if (window.timestampInterval) {
    clearInterval(window.timestampInterval);
  }

  // Update timestamp every minute (60000 milliseconds)
  window.timestampInterval = setInterval(updateLastUpdated, 60000);
  updateLastUpdated();
}

function updateLastUpdated() {
  const now = new Date();
  if (!window.lastUpdatedTime) {
    window.lastUpdatedTime = now;
  }
  const lastUpdated = window.lastUpdatedTime

  // Format absolute time
  const year = lastUpdated.getFullYear();
  const month = (lastUpdated.getMonth() + 1).toString().padStart(2, '0');
  const day = lastUpdated.getDate().toString().padStart(2, '0');
  const hours = lastUpdated.getHours().toString().padStart(2, '0');
  const minutes = lastUpdated.getMinutes().toString().padStart(2, '0');
  const seconds = lastUpdated.getSeconds().toString().padStart(2, '0');

  // Get timezone abbreviation
  const timezone = lastUpdated.toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ')[2];
  const absoluteTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone}`;

  // Calculate time difference in milliseconds
  const timeDiff = now - lastUpdated;
  const hoursDiff = timeDiff / (1000 * 60 * 60);

  // If within last 24 hours, show relative time
  if (hoursDiff < 24) {
    let relativeTime;
    if (timeDiff < 30000) { // less than 30 seconds
      relativeTime = 'Just now';
    } else {
      // Round to nearest minute
      const minutes = Math.round(timeDiff / 60000);
      if (minutes < 60) {
        relativeTime = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      } else {
        const hours = Math.floor(minutes / 60);
        relativeTime = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
    }

    // Update both spans with relative time and tooltip with absolute time
    const desktopSpan = document.querySelector('#last-updated span');
    const mobileSpan = document.querySelector('#last-updated-mobile span');

    if (desktopSpan && mobileSpan) {
      desktopSpan.textContent = relativeTime;
      mobileSpan.textContent = relativeTime;

      desktopSpan.setAttribute('data-bs-original-title', absoluteTime);
      mobileSpan.setAttribute('data-bs-original-title', absoluteTime);

      // Keep the dotted underline
      desktopSpan.style.borderBottom = '1px dotted #666';
      mobileSpan.style.borderBottom = '1px dotted #666';

      // Reinitialize tooltips
      // $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip();
    }
  } else {
    // If more than 24 hours, show absolute time
    const desktopSpan = document.querySelector('#last-updated span');
    const mobileSpan = document.querySelector('#last-updated-mobile span');

    if (desktopSpan && mobileSpan) {
      desktopSpan.textContent = absoluteTime;
      mobileSpan.textContent = absoluteTime;

      // Remove tooltips and dotted underline for absolute time display
      desktopSpan.removeAttribute('title');
      mobileSpan.removeAttribute('title');
      desktopSpan.style.borderBottom = 'none';
      mobileSpan.style.borderBottom = 'none';
      $('[data-bs-toggle="tooltip"]').tooltip('dispose');
    }
  }
}

export function slurmDateTime(time, _type, _row, meta) {
  const timedata = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  }
  const $span = $("<span>", { "title": time })
    .css("border-bottom", "0.15rem dotted var(--bs-secondary)");
  const daySplit = time.split("-");
  if (daySplit.length == 2) {
    timedata.days = parseInt(daySplit[0]);
    const colonSplit = daySplit[1].split(":");
    switch (colonSplit.length) {
      case 1:
        timedata.hours = parseInt(colonSplit[0]);
      case 2:
        timedata.minutes = parseInt(colonSplit[1]);
      case 3:
        timedata.seconds = parseInt(colonSplit[2]);
    }
  } else {
    const colonSplit = time.split(":");
    switch (colonSplit.length) {
      case 1:
        timedata.minutes = parseInt(colonSplit[0]);
        break;
      case 2:
        timedata.minutes = parseInt(colonSplit[0]);
        timedata.seconds = parseInt(colonSplit[1]);
        break;
      case 3:
        timedata.hours = parseInt(colonSplit[0]);
        timedata.minutes = parseInt(colonSplit[1]);
        timedata.seconds = parseInt(colonSplit[2]);
        break;
    }
  }

  const hoursStr = String(timedata.days * 24 + timedata.hours).padStart(2, "0");
  const minutesStr = String(timedata.minutes).padStart(2, "0");
  const secondsStr = String(timedata.seconds).padStart(2, "0");
  $span.text(`${hoursStr}:${minutesStr}:${secondsStr}`);

  // Return the outerHTML if used as a datatable renderer
  if (meta !== undefined) {
    return $span[0].outerHTML;
  } else {
    return $span;
  }
}

export function clusterBadge(cluster, _type, _job, meta) {
  const $span = $("<span>", {
    "class": "badge cluster-badge rounded-pill",
    "data-cluster": cluster,
  }).text(cluster.toUpperCase());

  if (meta !== undefined) {
    return $span[0].outerHTML;
  } else {
    return $span;
  }
}

export function jobStateBadge(state_raw, _type, job, meta) {
  const state = state_raw.split(" ")[0];
  const reason = (job === undefined) ? undefined : job["reason"];
  const state_verbose = (SIMPLE_JOB_STATE_CODES[state] || JOB_STATE_CODES[state.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
  const requeue_count = (job === undefined) ? undefined : job["requeue_count"];
  const $span = $("<span>", {
    "class": "text-nowrap",
  });
  const $badge = $("<span>", {
    "class": "job-state-badge badge p-2",
    "data-job-state": state.toLowerCase(),
    "data-bs-toggle": "tooltip",
    "data-bs-placement": "top",
    "title": `${state_verbose + (requeue_count ? `\nRequeued ${requeue_count} time(s)` : "")}`,
  })
    .text(`${state}${(requeue_count ? ` (${requeue_count})` : "")}`);
  $span.append($badge);

  if (reason !== undefined) {
    const reason_code = reason.split(" ")[0];
    const reason_verbose = (SIMPLE_JOB_REASON_CODES[reason_code] || JOB_REASON_CODES[reason_code] || "--").replaceAll(/"/g, "&quot;");
    $span.append(" due to ")
      .append($("<span>", {
        "class": "job-reason-filter badge rounded-pill text-bg-secondary shadow-sm",
        "data-bs-toggle": "tooltip",
        "data-bs-placement": "top",
        "title": reason_verbose,
      }).text(reason)
      );
  }

  if (meta !== undefined) {
    return $span[0].outerHTML;
  } else {
    return $span;
  }
}

(function ($) {
  $.fn.removePlaceholder = function () {
    this.removeClass("placeholder").css("width", "");
    return this;
  };
})(jQuery);
