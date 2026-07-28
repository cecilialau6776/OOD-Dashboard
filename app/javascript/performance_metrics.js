import { jobPathUrl, performanceMetricsApiSacctuserUrl, performanceMetricsApiUserdataUrl } from "./config";

// TODO: diff time periods don't seem to work.


jQuery(function () {
  main();

  // Store the currently selected time period
  let currentTimePeriod = 'alltime';

  // Handle desktop nav pills clicks
  document.querySelector('#myTab').querySelectorAll('.nav-link').forEach(tab => {
    tab.addEventListener('click', function (e) {
      e.preventDefault();

      // Get the target id without the '#'
      currentTimePeriod = this.getAttribute('data-bs-target').substring(1);

      // Update desktop view
      document.querySelector('#myTab').querySelectorAll('.nav-link').forEach(t => {
        t.classList.remove('active');
      });
      this.classList.add('active');

      // Update mobile select to match
      document.querySelector('.time-select').value = currentTimePeriod;

      // Update tab panes
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('show', 'active');
      });

      const targetPane = document.querySelector(this.getAttribute('data-bs-target'));
      if (targetPane) {
        targetPane.classList.add('show', 'active');
      }

      const isCustom = this.id === 'custom_range';
      toggleDateRangePicker(isCustom);
    });
  });

  // Handle mobile select change
  const timeSelect = document.querySelector('.time-select');
  timeSelect.addEventListener('change', function () {
    currentTimePeriod = this.value;

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('show', 'active');
    });

    const targetPane = document.querySelector(`#${currentTimePeriod}`);
    if (targetPane) {
      targetPane.classList.add('show', 'active');
    }

    // Update the desktop nav pills to match
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('data-bs-target') === `#${currentTimePeriod}`) {
        link.classList.add('active');
      }
    });

    const isCustom = this.value === 'custom';
    toggleDateRangePicker(isCustom);
  });

  // Handle window resize
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    const newWidth = window.innerWidth;
    const breakpoint = 768; // Bootstrap's md breakpoint

    // Only act if we're crossing the breakpoint
    if ((lastWidth < breakpoint && newWidth >= breakpoint) ||
      (lastWidth >= breakpoint && newWidth < breakpoint)) {

      // Update the appropriate control to match the current time period
      if (newWidth >= breakpoint) {
        // Switching to desktop
        document.querySelectorAll('.nav-link').forEach(link => {
          if (link.getAttribute('data-bs-target') === `#${currentTimePeriod}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      } else {
        // Switching to mobile
        timeSelect.value = currentTimePeriod;
      }
    }
    lastWidth = newWidth;
  });

  const dateRangeContainer = document.querySelector('#dateRangeContainer');
  const startDateInput = document.querySelector('#startDate');
  const endDateInput = document.querySelector('#endDate');
  const applyRangeButton = document.querySelector('#applyRange');

  // Set only end date to today by default
  const today = new Date();
  endDateInput.value = today.toISOString().split('T')[0];
  startDateInput.value = ''; // Leave start date blank

  // Show/hide date range picker when Custom is selected
  function toggleDateRangePicker(isCustom) {
    dateRangeContainer.style.display = isCustom ? 'block' : 'none';
  }

  // Handle apply button click
  applyRangeButton.addEventListener('click', function () {
    // Reset previous error states
    const errorDiv = document.getElementById('dateRangeError');
    errorDiv.style.display = 'none';
    startDateInput.classList.remove('is-invalid');
    endDateInput.classList.remove('is-invalid');

    // Validate start date
    if (!startDateInput.value) {
      showDateRangeError('Please select a start date');
      startDateInput.classList.add('is-invalid');
      return;
    }

    // Validate end date
    if (!endDateInput.value) {
      showDateRangeError('Please select an end date');
      endDateInput.classList.add('is-invalid');
      return;
    }

    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    // Validate date range
    if (startDate > endDate) {
      showDateRangeError('Start date must be before end date');
      startDateInput.classList.add('is-invalid');
      endDateInput.classList.add('is-invalid');
      return;
    }

    // Blur (unfocus) both inputs
    startDateInput.blur();
    endDateInput.blur();

    // If validation passes, update the metrics
    updateMetricsForDateRange(startDate, endDate);
  });

  // Add helper function to show error message
  function showDateRangeError(message) {
    const errorDiv = document.getElementById('dateRangeError');
    errorDiv.querySelector('span').textContent = message;
    errorDiv.style.display = 'block';
  }

  // Add input handlers to clear error states when user starts typing
  [startDateInput, endDateInput].forEach(input => {
    input.addEventListener('input', function () {
      this.classList.remove('is-invalid');
      document.getElementById('dateRangeError').style.display = 'none';
    });
  });

  // // Handle error alert close button
  // const errorDiv = document.getElementById('dateRangeError');
  // if (errorDiv) {
  //   errorDiv.querySelector('.close').addEventListener('click', function () {
  //     errorDiv.style.display = 'none';
  //     startDateInput.classList.remove('is-invalid');
  //     endDateInput.classList.remove('is-invalid');
  //   });
  // }

  function handleEnterKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if within a form
      applyRangeButton.click();
    }
  }

  startDateInput.addEventListener('keypress', handleEnterKey);
  endDateInput.addEventListener('keypress', handleEnterKey);

  // Add keyboard navigation for tab panels
  const tabButtons = document.querySelectorAll('[role="tab"]');
  tabButtons.forEach(tab => {
    tab.addEventListener('keydown', (e) => {
      let targetTab = null;

      switch (e.key) {
        case 'ArrowLeft':
          targetTab = tab.previousElementSibling?.querySelector('[role="tab"]');
          break;
        case 'ArrowRight':
          targetTab = tab.nextElementSibling?.querySelector('[role="tab"]');
          break;
        case 'Home':
          targetTab = tabButtons[0];
          break;
        case 'End':
          targetTab = tabButtons[tabButtons.length - 1];
          break;
      }

      if (targetTab) {
        e.preventDefault();
        targetTab.click();
        targetTab.focus();
      }
    });
  });

  // Update ARIA attributes when switching tabs
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[role="tab"]').forEach(t => {
        t.setAttribute('aria-selected', 'false');
      });
      tab.setAttribute('aria-selected', 'true');
    });
  });
});

// method to fetch specific user data from reportseff
async function fetchUserData() {
  try {
    return fetch(performanceMetricsApiUserdataUrl())
      .then(res => res.json())
      .then(data => data);
  } catch (error) {
    console.error('Error fetching user data:', error);
    showError();
    return null;
  }
}

// method to fetch specific user data from sacct
async function fetchUserSACCT() {
  try {
    return fetch(performanceMetricsApiUserdataUrl())
      .then(res => res.json())
      .then(data => data);
  } catch (error) {
    console.error('Error fetching SACCT data:', error);
    showError();
    return null;
  }
}

// returns the values of a key in a json file
function getValuesByKey(jsonData, key) {
  return jsonData.map(item => item[key]);
}

// calculate wall time and average job duration
function calculateTimes(submit_full, start_full, end_full) {
  // Filter for valid jobs that have both start and end times
  let validData = start_full.reduce((acc, value, index) => {
    if (value && value !== "Unknown" && value !== "None" &&
      end_full[index] && end_full[index] !== "Unknown" && end_full[index] !== "None") {
      acc.push({
        start: new Date(value),
        end: new Date(end_full[index])
      });
    }
    return acc;
  }, []);

  if (validData.length === 0) {
    return ["0 minutes", "0 minutes"];
  }

  // Calculate each job's duration in minutes
  let jobDurations = validData.map(job => {
    let durationMs = job.end - job.start;
    return durationMs / (1000 * 60); // Convert ms to minutes
  });

  // Calculate total wall time (sum of all job durations)
  let totalWallTimeMinutes = jobDurations.reduce((sum, duration) => sum + duration, 0);

  // Calculate mean job duration
  let meanJobDurationMinutes = totalWallTimeMinutes / validData.length;

  // Format durations
  function formatDuration(minutes) {
    if (minutes < 1) {
      return (minutes * 60).toFixed(2) + " seconds";
    } else if (minutes < 60) {
      return minutes.toFixed(2) + " minutes";
    } else {
      return (minutes / 60).toFixed(2) + " hours";
    }
  }

  return [
    formatDuration(meanJobDurationMinutes),
    formatDuration(totalWallTimeMinutes)
  ];
}

// calculate average of values
function getaverage(arr) {
  let float = arr.map(str => {
    let num = parseFloat(str);
    return isNaN(num) ? null : num;
  }).filter(num => num !== null);

  if (float.length === 0) return 0;

  // If all values are 0, return 0
  if (float.every(num => num === 0)) return 0;

  const average = ((float.reduce((partialSum, a) => partialSum + a, 0)) / (float.length)).toFixed(2);

  return average;
}

// displays how many jobs are below average efficiency
function belowaverage(arr) {
  let float = arr.map(str => {
    let num = parseFloat(str);
    return isNaN(num) ? null : num;
  }).filter(num => num !== null);

  const average = parseFloat(getaverage(float));

  // If average is 0, all jobs are considered "at average"
  if (average === 0) {
    return "All " + String(float.length).bold() + " jobs are at 0% efficiency.";
  }

  const count = float.filter(number => number < average).length;
  if (float.length === 0) {
    return "No jobs found.";
  } else if (count === 1) {
    return String(count).bold() + " out of " + String(float.length).bold() + " total jobs is below your average.";
  }
  return String(count).bold() + " out of " + String(float.length).bold() + " total jobs are below your average.";
}

// find job id with max efficiency
function findMax(jobids, arr) {
  let combined = arr.map((str, index) => {
    return { value: str, jobid: jobids[index] };
  });

  let filtered = combined.filter(item => {
    let num = parseFloat(item.value);
    return !isNaN(num);
  });

  if (filtered.length == 0) {
    return "No jobs";
  }

  let floatValues = filtered.map(item => parseFloat(item.value));
  let filteredJobIds = filtered.map(item => item.jobid);
  let maxValue = Math.max(...floatValues);
  let correspondingJobId = filteredJobIds[floatValues.indexOf(maxValue)];

  const jobPath = jobPathUrl(correspondingJobId);
  return `Job ID: <a href="${jobPath}">${correspondingJobId}</a> (${maxValue}%)`;
}

// find job id with min efficiency
function findMin(jobids, arr) {
  let combined = arr.map((str, index) => {
    return { value: str, jobid: jobids[index] };
  });

  let filtered = combined.filter(item => {
    let num = parseFloat(item.value);
    return !isNaN(num);
  });

  if (filtered.length == 0) {
    return "No jobs";
  }

  let floatValues = filtered.map(item => parseFloat(item.value));
  let filteredJobIds = filtered.map(item => item.jobid);
  let minValue = Math.min(...floatValues);
  let correspondingJobId = filteredJobIds[floatValues.indexOf(minValue)];

  const jobPath = jobPathUrl(correspondingJobId);
  return `Job ID: <a href="${jobPath}">${correspondingJobId}</a> (${minValue}%)`;
}

// get user average wait time
function getUserWaitTime(usersacct) {
  let submit_full = getValuesByKey(usersacct, "Submit");
  let start_full = getValuesByKey(usersacct, "Start");

  let { start, submit } = start_full.reduce((acc, value, index) => {
    if (value !== "Unknown" && value !== "None") {
      acc.start.push(value);
      acc.submit.push(submit_full[index]);
    }
    return acc;
  }, { start: [], submit: [] });

  let waittime = [];
  const date = new Date();
  for (let i = 0; i < submit.length; i++) {
    let submitDate = new Date(submit[i]);
    let startDate = new Date(start[i]);
    let diffInMs = startDate - submitDate;
    let diffInMins = diffInMs / (1000 * 60);
    waittime.push(parseFloat(diffInMins));
  }

  if (waittime.length == 0) {
    return "0 minutes";
  }

  if (getaverage(waittime) <= 1) {
    return (getaverage(waittime) * 60).toFixed(2) + " seconds";
  } else if (getaverage(waittime) <= 60) {
    return getaverage(waittime) + " minutes";
  } else {
    return (getaverage(waittime) / 60).toFixed(2) + " hours";
  }
}

// generate info for different timeframes
function timeFrameInfo(userdata, usersacct) {
  let jobIds = getValuesByKey(usersacct, "JobID");
  let submitTimes = getValuesByKey(usersacct, "Submit");
  let startTimes = getValuesByKey(usersacct, "Start");
  let endTimes = getValuesByKey(usersacct, "End");

  const currentDate = new Date();

  const timeRanges = {
    oneday: new Date(currentDate),
    oneweek: new Date(currentDate),
    onemonth: new Date(currentDate),
    oneyear: new Date(currentDate),
    alltime: new Date(0), // Beginning of time
    custom: null // Will be handled differently
  };

  timeRanges.oneday.setDate(currentDate.getDate() - 1);
  timeRanges.oneweek.setDate(currentDate.getDate() - 7);
  timeRanges.onemonth.setMonth(currentDate.getMonth() - 1);
  timeRanges.oneyear.setFullYear(currentDate.getFullYear() - 1);

  const filterJobs = (timeRange) => {
    const filteredSacct = usersacct.filter(job => new Date(job.Submit) >= timeRange);
    const filteredUser = userdata.filter(job => {
      const sacctData = filteredSacct.find(s => s.JobID === job.jobid);
      return sacctData !== undefined;
    });
    return [filteredUser, filteredSacct];
  };

  // Process each time period
  Object.entries(timeRanges).forEach(([period, date]) => {
    if (period === 'custom') {
      return; // Skip custom here as it will be handled separately
    }

    const [filteredUserData, filteredSacctData] = period === 'alltime'
      ? [userdata, usersacct]
      : filterJobs(date);

    updatePeriodMetrics(period, filteredUserData, filteredSacctData);
  });
}

// Update the updatePeriodMetrics function to accept both data sources
function updatePeriodMetrics(period, filteredUserData, filteredSacctData) {
  // Create a merged dataset with the SACCT data
  const filteredJobs = filteredUserData.map(job => {
    const sacctData = filteredSacctData.find(s => s.JobID === job.jobid);
    if (sacctData) {
      return {
        ...job,
        Submit: sacctData.Submit,
        Start: sacctData.Start,
        End: sacctData.End
      };
    }
    return job;
  });

  const times = calculateTimes(
    getValuesByKey(filteredJobs, "Submit"),
    getValuesByKey(filteredJobs, "Start"),
    getValuesByKey(filteredJobs, "End")
  );

  // Update metrics for this period
  const metrics = {
    avgjobduration: times[0],
    walltime: times[1],
    userjobs: `${filteredJobs.length} jobs`,
    userwaittime: getUserWaitTime(filteredJobs)
  };

  // Update efficiency metrics
  ['time', 'mem', 'cpu'].forEach(metric => {
    const values = getValuesByKey(filteredJobs, `${metric}eff`);
    const jobids = getValuesByKey(filteredJobs, "jobid");

    const avgEfficiency = parseFloat(getaverage(values));
    const efficiencyElement = document.getElementById(`${period}avg${metric}eff`);

    if (efficiencyElement) {
      // Remove existing efficiency classes
      efficiencyElement.classList.remove('efficiency-poor', 'efficiency-moderate', 'efficiency-good');

      // Add appropriate efficiency class
      if (avgEfficiency < 60) {
        efficiencyElement.classList.add('efficiency-poor');
      } else if (avgEfficiency < 80) {
        efficiencyElement.classList.add('efficiency-moderate');
      } else {
        efficiencyElement.classList.add('efficiency-good');
      }

      efficiencyElement.innerHTML = avgEfficiency + "%";
    }

    // Update other metrics
    const belowElement = document.getElementById(`${period}${metric}below`);
    const mostElement = document.getElementById(`${period}most${metric}`);
    const leastElement = document.getElementById(`${period}least${metric}`);

    if (belowElement) belowElement.innerHTML = belowaverage(values);
    if (mostElement) mostElement.innerHTML = findMax(jobids, values);
    if (leastElement) leastElement.innerHTML = findMin(jobids, values);
  });

  // Update all elements for this period
  Object.entries(metrics).forEach(([key, value]) => {
    const element = document.getElementById(`${period}${key}`);
    if (element) {
      element.innerHTML = value;
    }
  });
}

// Update the updateMetricsForDateRange function
async function updateMetricsForDateRange(startDate, endDate) {
  try {
    // Show loading state
    const loadingDiv = document.getElementById('loading');
    const mainContent = document.getElementById('mainContent');
    loadingDiv.style.display = 'block';
    mainContent.style.opacity = '0';

    // Fetch both data sources
    const [userdata, usersacct] = await Promise.all([
      fetchUserData(),
      fetchUserSACCT()
    ]);

    if (!userdata || !usersacct) {
      throw new Error('Failed to fetch data');
    }

    // Set start date to beginning of day (00:00:00.000)
    startDate.setHours(0, 0, 0, 0);

    // Set end date to end of day (23:59:59.999)
    endDate.setHours(23, 59, 59, 999);

    // Filter both datasets based on date range (inclusive)
    const filteredSacctData = usersacct.filter(item => {
      const itemDate = new Date(item.Submit);
      return itemDate >= startDate && itemDate <= endDate;
    });

    const filteredUserData = userdata.filter(job => {
      const sacctData = filteredSacctData.find(s => s.JobID === job.jobid);
      return sacctData !== undefined;
    });

    // Show the custom tab
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('show', 'active');
    });
    const customPane = document.querySelector('#custom');
    if (customPane) {
      customPane.classList.add('show', 'active');
    }

    // Update metrics specifically for custom period
    updatePeriodMetrics('custom', filteredUserData, filteredSacctData);

    // Hide loading state
    loadingDiv.style.display = 'none';
    mainContent.style.opacity = '1';

  } catch (error) {
    console.error('Error updating metrics:', error);
    showError();
  }
}

// Update the userMetrics function to be simpler since timeFrameInfo now handles everything
function userMetrics(userdata, usersacct) {
  timeFrameInfo(userdata, usersacct);
}

// main
async function main() {
  const loadingDiv = document.getElementById('loading');
  const mainContent = document.getElementById('mainContent');
  const errorDiv = document.getElementById('errorMessage');

  errorDiv.style.display = 'none';
  loadingDiv.style.display = 'block';
  mainContent.style.opacity = '0';

  // fetch all data
  const userdata = await fetchUserData();
  const usersacct = await fetchUserSACCT();

  if (userdata && usersacct) {
    userMetrics(userdata, usersacct);
    loadingDiv.style.display = 'none';
    mainContent.style.opacity = '1';
  }
}

function showError() {
  const errorDiv = document.getElementById('errorMessage');
  const loadingDiv = document.getElementById('loading');
  const mainContent = document.getElementById('mainContent');

  loadingDiv.style.display = 'none';
  mainContent.style.opacity = '0';
  errorDiv.style.display = 'block';
}

async function retryLoad() {
  const errorDiv = document.getElementById('errorMessage');
  const loadingDiv = document.getElementById('loading');

  errorDiv.style.display = 'none';
  loadingDiv.style.display = 'block';

  main(); // Retry loading the data
}
