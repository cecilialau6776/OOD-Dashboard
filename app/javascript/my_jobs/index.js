'use strict';

import { Chart, BarController, BarElement, Title, Legend, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import ChartPluginStacked100 from 'chartjs-plugin-stacked100';
Chart.register(BarController, BarElement, Title, Legend, ChartPluginStacked100, CategoryScale, LinearScale, [Tooltip]);

import moment from 'moment-timezone';
import 'daterangepicker';
import toastr from 'toastr';

import { pageConfigData, jobPathUrl, filesPath, cancelJobsPath, username, csrfToken } from '../config.js';

const jobInfoUrl = (cluster, id) => { return pageConfigData()["jobInfoUrl"].replace("JOB_ID", id).replace("CLUSTER", cluster) };
const myJobsUrl = () => { return pageConfigData()["myJobsUrl"] };

window.csrf_token = csrfToken();

const isLowTimeEff = (rowData) => (rowData.state === "COMPLETED" || rowData.state === "TIMEOUT") && rowData["timeeff"] < TIME_EFF_THRESHOLD;
const isLowCPUMemEff = (rowData) => (rowData.state === "COMPLETED" || rowData.state === "TIMEOUT") && rowData["memeff"] < MEM_EFF_THRESHOLD;

const TABLE_COLUMNS = [
  {
    // Checkbox Select
    orderable: true,
    render: $.fn.dataTable.render.select(),
    columnControl: ["order"],
    // className: "border-right align-text-top"
  },
  {
    // Detail chevron
    className: 'dt-control',
    orderable: false,
    data: null,
    defaultContent: '',
    columnControl: [],
  },
  {
    title: "Cluster",
    data: "cluster",
    render: function (cluster, _type, _job) {
      return $("<span>", {
        "class": "badge cluster-badge rounded-pill",
        "data-cluster": cluster,
      }).text(cluster.toUpperCase())[0].outerHTML;
    },
    columnControl: ["searchDropdown", "order", "rowGroup"],
  },
  {
    title: "Job ID",
    data: "jobid",
    className: "text-nowrap",
    render: (job_id, _type, job) => {
      return `<a href="${jobPathUrl(job.cluster, job_id)}" class="job-id-link">${job_id}</a>`;
    }
  },
  {
    title: "Job Name",
    data: "jobname",
    render: (job_name, _type, job) => {
      // let linkToSession = "";
      // if (row[getColIndex("Session ID")] !== "N/A") {
      //   linkToSession = `
      //                   (<a href="${filesPath}${row[getColIndex("Working Directory")]}">${row[getColIndex("Session ID")]}</a>)
      //               `;
      // }
      const $nameSpan = $("<span>", {
        "class": "text-nowrap",
      }).append(job_name);
      if (isLowTimeEff(job) || isLowCPUMemEff(job)) {
        $nameSpan
          .append(" ")
          .append(
            $("<a>", { "class": "efficiency-warning", "role": "button" })
              .append($("<i>", {
                "class": "fa fa-warning text-warning",
                "data-bs-toggle": "tooltip",
                "title": "You requested significantly more resources than you used. Click to learn more.",
              }))
          );
      }
      return $nameSpan[0].outerHTML;
    }
  },
  {
    title: "User",
    data: "user",
    render: (user, _type, _job) => `<span class="user-filter" style="${user === username() ? "text-decoration: underline;" : ""}">${user}</span>`,
    columnControl: ["searchDropdown", "order", "rowGroup"],
  },
  {
    title: "Account",
    data: "account",
    columnControl: ["searchDropdown", "order", "rowGroup"],
    // render: (data, _type, _row) => `<span class="account-filter">${data}</span>`,
    // filterType: "multiselect",
  },
  {
    title: "Start Time",
    data: "start",
    render: (start_ts, _type, _job) => {
      const timestamp = moment.unix(start_ts);
      // TODO: fix timestamp rendering, i18n
      const $timestamp_span = $("<span>", { "class": "text-nowrap" }).text(
        timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--"
      );
      return $timestamp_span[0].outerHTML;
    },
  },
  {
    title: "End Time",
    data: "end",
    render: (end_ts, _type, _job) => {
      const timestamp = moment.unix(end_ts);
      const $timestamp_span = $("<span>", { "class": "text-nowrap" }).text(
        timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--"
      );
      return $timestamp_span[0].outerHTML;
    },
  },
  {
    title: "Time Used",
    data: "elapsed",
    render: (elapsed_time, _type, job) => {
      if (job["start"] !== "N/A" && job["end"] === "N/A") {
        return secondsToTimestr(moment().diff(moment.unix(job["start"]), 'seconds'));
      }
      return secondsToTimestr(elapsed_time);
    }
  },
  {
    title: "Submit Time",
    data: "submit",
    render: (submit_ts, _type, _job) => {
      const timestamp = moment.unix(submit_ts);
      return timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--";
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Wait Time",
    data: "planned",
    render: (planned_seconds, _type, _job) => {
      return secondsToTimestr(planned_seconds);
    },
    visible: false,
    searchable: false,
  },
  /* {
   *     title: "Used GPU Hours",
   *     data: "used_gpu_hours",
   *     visible: true,
   *     searchable: false,
   *     render: $.fn.dataTable.render.number(null, null, 4, "", ""),
   * }, */
  /* {
   *     title: "Required GPU Hours",
   *     data: "required_gpu_hours",
   *     visible: false,
   *     searchable: false,
   * }, */
  {
    title: "Time Efficiency",
    data: "timeeff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "CPU Efficiency",
    data: "cpueff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "Memory Efficiency",
    data: "memeff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "Partition",
    data: "partition",
    columnControl: ["searchDropdown", "order", "rowGroup"],
    render: function (partition, _type, _job) {
      return $("<span>", {
        "class": "badge partition-badge rounded-pill",
        "data-partition": partition,
      }).text(partition.toUpperCase())[0].outerHTML;
    },
    // filterType: "multiselect",
  },
  {
    title: "QOS",
    data: "qos",
    columnControl: ["searchDropdown", "order", "rowGroup"],
    // render: (data, _type, _row) => `<span class="qos-filter">${data}</span>`,
    // filterType: "multiselect",
  },
  {
    title: "State",
    data: "state",
    render: (state_raw, _type, job) => {
      const state = state_raw.split(" ")[0];
      const reason = job["reason"];
      var state_verbose = (SIMPLE_JOB_STATE_CODES[state] || JOB_STATE_CODES[state.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
      var reason_verbose = (SIMPLE_JOB_REASON_CODES[reason.split(" ")[0]] || JOB_REASON_CODES[reason.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
      const requeue_count = job["requeue_count"];
      const $span = $("<span>", {
        "class": "text-nowrap",
      });
      const $badge = $("<a>", {
        "class": "job-state-badge badge p-2",
        "data-job-state": state.toLowerCase(),
        "data-bs-toggle": "tooltip",
        "data-bs-placement": "top",
        "title": `${state_verbose + (requeue_count ? `\nRequeued ${requeue_count} time(s)` : "")}`,
      })
        .text(`${state}${(requeue_count ? ` (${requeue_count})` : "")}`);
      $span.append($badge);

      if (reason !== "None" && reason_verbose !== "--") {
        $span.append(" due to ")
          .append($("<span>", {
            "class": "job-reason-filter badge rounded-pill text-bg-secondary shadow-sm",
            "data-bs-toggle": "tooltip",
            "data-bs-placement": "top",
            "title": reason_verbose,
          }).text(reason)
          );
      }
      return $span[0].outerHTML;
    },
    columnControl: ["searchDropdown", "order", "rowGroup"],
  },
  {
    title: "Reason",
    data: "reason",
    visible: false,
    searchable: false,
  },
  {
    title: "Total Time",
    data: "timelimit",
    render: (timelimit, _type, _job) => {
      return secondsToTimestr(timelimit);
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Requested Memory",
    data: "reqmem",
    visible: false,
    searchable: false,
  },
  {
    title: "Allocated CPU Count",
    data: "alloccpus",
    visible: false,
    searchable: false,
  },
  {
    title: "Total CPU Time",
    data: "totalcpu",
    render: (total_cpu_seconds, _type, _job) => {
      return secondsToTimestr(total_cpu_seconds);
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Working Directory",
    data: "workdir",
    visible: false,
    searchable: false,
  },
  {
    title: "Session ID",
    data: "sessionid",
    visible: false,
    searchable: false,
  },
  {
    title: "Requeue Count",
    data: "requeue_count",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Used Memory",
    data: "maxrss",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Disk Write",
    data: "maxdiskwrite",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Disk Read",
    data: "maxdiskread",
    visible: false,
    searchable: false,
  },
  {
    title: "Nodes",
    data: "nodelist",
    visible: false,
    render: (data, _type, _row) => {
      return data !== "N/A" ? data : "--"
    },
    // filterType: "multiselect",
  },
  {
    title: "Requested Resources",
    data: "reqtres",
    visible: false,
    searchable: false,
  },
  {
    title: "_timestamp",
    data: "timestamp",
    visible: false,
    searchable: false,
  },
  // {
  //   title: "Actions",
  //   searchable: false,
  //   orderable: false,
  //   // TODO: redo this
  //   render: (_data, _type, job) => {
  //     let nodes = job[getColIndex("Nodes")].split(",");
  //     return `
  //               <div id="job-actions-group" class="d-flex justify-content-between" aria-label="Job Actions">
  //                   <button class="cancel-job-button btn btn-sm btn-danger shadow-none mx-1 ${!(job[getColIndex("User")] === "${username()}" && ["RUNNING", "PENDING", "SUSPENDED"].includes(job[getColIndex("State")])) ? "d-none" : ""}" title="Cancel This Job">
  //                       <i class="fas fa-trash"></i>
  //                   </button>
  //                   <div class="btn-group ${!(job[getColIndex("User")] === "${username()}" && job[getColIndex("State")] === "RUNNING") ? "d-none" : ""}">
  //                       <button class="connect-to-job-button btn btn-sm btn-info shadow-none" title="Copy Connect to Job Shell Command">
  //                           <i class="fas fa-plug"></i>
  //                       </button>
  //                       <button type="button" class="btn btn-sm btn-info shadow-none dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
  //                           <span class="visually-hidden">Toggle Dropdown</span>
  //                       </button>
  //                       <div class="dropdown-menu">
  //                           ${nodes.map((node) => {
  //       return `<button class="dropdown-item connect-to-node-button">${node}</button>`
  //     }).join("\n")}
  //                       </div>
  //                   </div>
  //               </div>
  //               `;
  //   },
  // },
];

// These are to make sure we aren't simultaneously running multiple instances of job refresh or cancellation code
var cancelJobsMutex = false;
var confirmModalMutex = false;

// Get index of colName inside COLUMNS or -1 if not found
function getColIndex(colName) {
  return TABLE_COLUMNS.findIndex(column => column?.title === colName);
}

function secondsToTimestr(seconds) {
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var seconds = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

let charts = [
  {
    title: "Job State Distribution",
    chartObj: null,
    refreshChart: (table, chart, useGlobalData) => {
      var counts = {};

      // Count the number of entries for each position
      table.column("State:title", { search: useGlobalData ? "none" : "applied" }).data().each((jobState) => {
        var jobStateCode = jobState.split(" ")[0];
        if (counts[jobStateCode]) {
          counts[jobStateCode] += 1;
        }
        else {
          counts[jobStateCode] = 1;
        }
      });

      let data = Object.entries(counts).map((e) => ({
        label: e[0],
        data: [e[1]],
        //backgroundColor: pattern.draw(JOB_STATE_COLORS[e[0]]?.pattern || _.sample(PATTERNS), JOB_STATE_COLORS[e[0]]?.bg),
        backgroundColor: JOB_STATE_COLORS[e[0]]?.bg,
      })).sort((a, b) => parseInt(b.data[0]) - parseInt(a.data[0]));

      chart.data = {
        labels: ["Job State"],
        datasets: data,
      };

      chart.update();

      chart.canvas.parentNode.style.height = `${chart.legend.height + 120}px`;
      chart.resize();
      chart.canvas.parentNode.style.height = `${chart.legend.height + 120}px`;
      chart.resize();
    },
  },
];

async function cancelJobs(cluster, jobIds) {
  return fetch(cancelJobsPath(cluster), {
    method: "DELETE",
    redirect: "manual",
    body: JSON.stringify({
      job_ids: jobIds.join(","),
    }),
    headers: {
      'X-CSRF-Token': csrf_token,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  }).then(res => {
    if (res.status === 0 && res.type === "opaqueredirect") {
      redirectToLogin();
      return Promise.reject(res);
    }
    if (!res.ok) {
      return Promise.reject(res);
    }
    return res.json();
  }).then(data => {
    toastr.success("Refreshing job list...", `Successfully cancelled ${data["cancelled"].length} job(s): ${data["cancelled"].join(",")}`);
    if (deselectOnSuccess) {
      getCurrentTable().rows().deselect();
    }
    loadJobs();
  }).catch(_error => {
    toastr.error("Failed to cancel job(s)");
  });
}

function initializeDatatable() {
  const colvis_columns = TABLE_COLUMNS.reduce((accumulator, column) => {
    if ("title" in column && "data" in column && column["data"] !== null && column["visible"] !== false) {
      accumulator.push(`${column["title"]}:title`);
    }
    return accumulator;
  }, []);

  const datatable = $('#my-jobs-table').DataTable({
    scrollX: true,
    pageLength: 10,
    fixedHeader: true,
    rowId: (data) => `${data.cluster}-${data.jobid}`,
    select: {
      style: 'multi+shift',
      selector: "td.dt-select:first-child",
      headerCheckbox: true,
      info: false,
    },
    language: {
      emptyTable: "No jobs available in table",
      zeroRecords: "No matching jobs found",
      info: "<span class='text-wrap'>Showing _START_ to _END_ of _TOTAL_ jobs</span>",
      infoFiltered: "<span class='text-wrap'>(filtered from _MAX_ total jobs)</span>",
      infoEmpty: "Showing 0 to 0 of 0 jobs",
    },
    columnControl: ["searchDropdown", "order"],
    columns: TABLE_COLUMNS,
    layout: {
      top1Start: {
        buttons: [
          {
            extend: "colvis",
            columns: colvis_columns,
          },
          {
            text: "Cancel 0 jobs",
            enabled: false,
            name: "dtCancelJobsButton",
            action: function (e, dt, $button, config) {
              const button = dt.button("dtCancelJobsButton:name");
              button.disable();

              if (cancelJobsMutex) {
                toastr.info("Currently cancelling jobs. Please wait.");
                return;
              }
              const selectedRows = dt.rows({ selected: true });
              const selectedCount = selectedRows.count();

              if (selectedCount === 0) {
                toastr.warning("No jobs were selected.");
                cancelJobsMutex = false;
                button.enable();
                return;
              }

              $("#cancelJobsModalLabel").text(`Cancel ${selectedCount} job(s)?`);
              $("#cancelJobsModal .modal-body").text(`Are you sure you want to cancel ${selectedCount} job(s)?`);
              $("#cancelJobsModal").modal("show");
            }
          }
        ],
      }
    },
  });

  // bind click handler for cancelling jobs
  $("#confirmCancelJobs").on("click", function () {
    const button = datatable.button("dtCancelJobsButton:name");
    button.disable();

    $("#cancelJobsModal").modal("hide");

    if (cancelJobsMutex) {
      toastr.info("Currently cancelling jobs. Please wait.");
      return;
    }

    const selectedRows = datatable.rows({ selected: true });
    const selectedCount = selectedRows.count();

    const clusterJobIds = {}

    $.each(selectedRows.data(), (_idx, job) => {
      if (!(job.cluster in clusterJobIds)) {
        clusterJobIds[job.cluster] = [];
      }
      clusterJobIds[job.cluster].push(job.jobid);
    });

    cancelJobsMutex = true;
    if (selectedCount === 0) {
      toastr.warning("No jobs were selected.");
      cancelJobsMutex = false;
      button.enable();
      return;
    }
    const $buttonTooltipDiv = button.node().parent();
    $buttonTooltipDiv.attr("title", "Currently cancelling jobs. Please wait.");
    $buttonTooltipDiv.tooltip({ boundary: 'window' });

    const cancelPromises = Object.entries(clusterJobIds).map(([cluster, jobIds]) => cancelJobs(cluster, jobIds));

    Promise.allSettled(cancelPromises)
      .then(() => {
        setTimeout(() => {
          cancelJobsMutex = false;
          $("#cancel-selected-jobs-button").attr("disabled", getSelectedRows().count() === 0);
          $(".cancel-job-button").attr("disabled", false);
        }, 0.5 * 1000);
      });
  });

  // bind click handler for toggling child rows
  datatable.on("click", "td.dt-control", function () {
    let tr = $(this).closest("tr");
    let row = datatable.row(tr);
    toggleJobDetails(row);
  });
  datatable.on("click", ".efficiency-warning", function () {
    let tr = $(this).closest("tr");
    let row = datatable.row(tr);
    showJobDetails(row);
  });

  datatable.buttons().nodes().wrap("<div>");

  // Wrap cancel jobs button in a div so we can trigger a tooltip on it
  const $button = datatable.button("dtCancelJobsButton:name").node();
  const $buttonTooltipDiv = $button.parent();

  // "ungroup" buttons
  $buttonTooltipDiv.parent().addClass("gap-2");

  // Update cancel jobs button
  const toggleSelect = function (e, dt, type, indexes) {
    const selectedRows = dt.rows({ selected: true });
    const selectedCount = selectedRows.count();
    const button = dt.button("dtCancelJobsButton:name");
    button.text(`Cancel ${selectedCount} jobs`);
    if (selectedCount === 0) {
      button.disable();
      $buttonTooltipDiv.tooltip("dispose");
      $buttonTooltipDiv.removeAttr("title");
      return;
    }
    if (selectedRows.filter((rowIdx) => { return dt.cell(rowIdx, "User:title").data() !== username() }).count() !== 0) {
      button.disable();
      $buttonTooltipDiv.attr("title", "You cannot cancel jobs from other users.");
      $buttonTooltipDiv.tooltip({ boundary: 'window' });
      return;
    }
    button.enable();
    $buttonTooltipDiv.tooltip("dispose");
    $buttonTooltipDiv.removeAttr("title");
  }
  datatable.on("select", toggleSelect);
  datatable.on("deselect", toggleSelect);

  // Update chart on draw
  datatable.on("draw", function () {
    const chart = Chart.getChart("chart1");

    const counts = {};
    datatable.column("State:title").data().each((jobStateLong) => {
      const jobState = jobStateLong.split(" ")[0];
      if (!(jobState in counts)) {
        counts[jobState] = 0;
      }
      counts[jobState] += 1;
    });
    const data = Object.entries(counts).map(([jobState, count]) => {
      return {
        label: jobState,
        data: [count],
        backgroundColor: window.getComputedStyle(document.body).getPropertyValue(`--job-state-${jobState.split("_").at(-1).toLowerCase()}-bg`)
      }
    }).sort((a, b) => parseInt(b.data[0]) - parseInt(a.data[0]));

    chart.data = {
      labels: ["Job State"],
      datasets: data,
    };
    chart.update();
  });
}

function initializeDatetimeRangeSelector(start, end) {
  const refreshDatetimeRangeSelector = (start, end) => {
    const dateTimeFormat = "YYYY-MM-DD HH:mm z";
    const localTimeZone = moment.tz.guess();
    const startText = start.tz(localTimeZone).format(dateTimeFormat);
    const endText = end.tz(localTimeZone).format(dateTimeFormat);
    const newLabel = `<span class="text-nowrap">${startText}</span> to <span class="text-nowrap">${endText}</span>`;
    $("#datetime-range-selector #datetime-range-selector-text").html(newLabel);
  };

  refreshDatetimeRangeSelector(start, end);

  $('#datetime-range-selector').daterangepicker({
    startDate: start,
    endDate: end,
    minDate: moment(0),
    maxDate: moment(),
    maxSpan: { "years": 1 },
    showDropdowns: true,
    timePicker: true,
    timePicker24Hour: true,
    ranges: {
      'Today': [moment().startOf('day'), moment()],
      'Last 24 hours': [moment().subtract(24, 'hours'), moment()],
      'Last 7 Days': [moment().subtract(6, 'days'), moment()],
      'Last 30 Days': [moment().subtract(30, 'days'), moment()],
      'This Month': [moment().startOf('month'), moment().endOf('month')],
      'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
    },
    alwaysShowCalendars: true,
    autoApply: false,
    linkedCalendars: true,
  }, function (start, end, _label) {
    // console.log(`Changed start: ${start.toISOString()}`);
    // console.log(`Changed end: ${end.toISOString()}`);
    refreshDatetimeRangeSelector(start, end);
    loadJobs(start, end);
  });
}

function initializeChart() {
  const chart = new Chart(
    document.getElementById("chart1"),
    {
      type: 'bar',
      data: {},
      plugins: [ChartPluginStacked100],
      options: {
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        onClick: (_event, elements, chart) => {
          toggleFilterText(chart.config._config.data.datasets[elements[0].datasetIndex].label);
        },
        indexAxis: "y",
        plugins: {
          title: {
            display: true,
            text: 'Job State Distribution'
          },
          stacked100: {
            enable: true,
          },
          legend: {
            position: "bottom",
            onClick: (_event, legendItem, _legend) => {
              toggleFilterText(legendItem.text);
            },
          },
        },
      },
    }
  );
}

function initializePage(start, end) {
  initializeChart();
  initializeDatatable();
  initializeDatetimeRangeSelector(start, end);

  // Bind refresh jobs button
  $("button.refresh-btn").on("click", () => { loadJobs() });
}

let selectedChart = charts[0];

function getChartByTitle(chartTitle) {
  return charts.find(chart => chart.title === chartTitle);
}

// Get selected chart
function getSelectedChart() {
  return selectedChart;
}

// Refresh selected chart with new table data
function refreshSelectedChart(chartTitle = null) {
  chartTitle = chartTitle || getSelectedChart().title;

  if (!charts.some((chart) => chart.title === chartTitle)) {
    toastr.error(`${chartTitle} is not a valid chart`);
    return;
  }

  if (getSelectedChart().title !== chartTitle && getSelectedChart().chartObj !== null) {
    getSelectedChart().chartObj.destroy()
    getSelectedChart().chartObj = null;
  }
  selectedChart = getChartByTitle(chartTitle);
  if (getSelectedChart().chartObj === null) {
    getSelectedChart().chartObj = new Chart(document.getElementById("chart1"), getSelectedChart().config);
  }

  const useGlobalData = $("#global-data-chart-toggle").is(":checked");

  if (getCurrentTable().rows({ search: useGlobalData ? "none" : "applied" }).count() === 0) {
    $(getSelectedChart().chartObj.canvas).addClass("d-none");
    if ($(getSelectedChart().chartObj.canvas.parentNode).find("#no-data-chart-text").length === 0) {
      $(getSelectedChart().chartObj.canvas.parentNode).append(`
                <div id="no-data-chart-text" class="w-100 h-100 d-flex justify-content-center">
                    <div class="h4 d-flex align-items-center">No data to display</div>
                </div>
                `);
    }
  } else {
    $(getSelectedChart().chartObj.canvas).removeClass("d-none");
    $(getSelectedChart().chartObj.canvas.parentNode).find("#no-data-chart-text").remove();
    getSelectedChart().refreshChart(getCurrentTable(), getSelectedChart().chartObj, useGlobalData);
  }
}

// Enable bootstrap tooltips
function enableTooltips() {
  $('[data-bs-toggle="tooltip"]').tooltip({ boundary: 'window' });
}

function loadJobs(start = null, end = null) {
  $('.refresh-btn i').addClass('refresh-spin');

  if (start === null) {
    start = $('#datetime-range-selector').data().startDate;
  }
  if (end === null) {
    end = $('#datetime-range-selector').data().endDate;
  }

  fetch(`${myJobsUrl()}?` + new URLSearchParams({
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  }).toString(), {
    redirect: "manual",
    cache: "no-store"
  }).then(res => {
    return res.json();
  }).then(data => {
    const datatable = $("#my-jobs-table").DataTable();
    datatable.clear();
    datatable.rows.add(data);
    datatable.draw();


    $(".card-body").removeClass("d-none");
    $(".error-div").addClass("d-none");

    return;

    // Don't try to submit when pressing enter while search input is focused
    $(window).keydown(function (event) {
      if (event.keyCode == 13) {
        event.preventDefault();
        return false;
      }
    });

    setupPerRowEventListeners();

    refreshColumnFilters();

    // Initialize default selected chart
    refreshSelectedChart();

    function setupPerRowEventListeners() {
      $(".cancel-job-button").off('click').on("click", function (_e) {
        let tr = $(this).closest("tr");
        let row = getCurrentTable().row(tr);
        let jobId = row.data()[getColIndex("Job ID")];
        cancelJobs([jobId], false, "No jobs specified", "Failed to cancel job");
      });
    }

    $("#refresh-jobs-button").on("click", () => {
      loadJobs();
    });

    $("#reset-filters-button").on("click", () => {
      getCurrentTable().order([[getColIndex("_timestamp"), 'desc']]).draw();
      $("#my-jobs-search").val("");
      getCurrentTable().search("").draw();
    });

    $("#toggle-efficiency-columns-button").on("click", () => {
      ["Time Efficiency", "CPU Efficiency", "Memory Efficiency"].forEach((colName) => {
        let col = getCurrentTable().column(getColIndex(colName));
        col.visible(!col.visible());
      });
    });
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

// Get selected rows
function getSelectedRows() {
  return getCurrentTable().rows({ selected: true });
}

function redirectToLogin() {
  location.reload();
}

// Get rows with child rows open on current page
function getExpandedRows() {
  return getCurrentTable().rows(function (_idx, _data, node) {
    return $(node).hasClass("dt-hasChild");
  });
}

// Get currently visible table
function getCurrentTable() {
  return $.fn.dataTable.tables({ visible: true, api: true });
}

// Add or remove word from search bar
function toggleFilterText(text) {
  const filteredText = text.trim().split(" ")[0];
  if (!($("#my-jobs-search").val().toLowerCase().includes(filteredText.toLowerCase()))) {
    $("#my-jobs-search").val(($("#my-jobs-search").val() + " " + filteredText).trim()).trigger("input");
  } else {
    $("#my-jobs-search").val($("#my-jobs-search").val().replace(new RegExp(filteredText, "i"), "").trim()).trigger("input");
  }
}

// show job details table
function showJobDetails(row, showLoading = true, forceFetch = false) {
  $("#close-job-details-button").attr("disabled", false);

  const jobdata = row.data();
  const jobId = jobdata.jobid;

  if (row.child() && !forceFetch) {
    row.child.show();
  } else {
    if (showLoading) {
      row.child(`
                    <div id="details-panel-${jobId}">
                        <div class="d-flex align-items-center">
                            <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
                            &nbsp;
                            <strong class="me-1">Loading job info for ${jobId}...</strong>
                        </div>
                    </div>
                `).show();
    }

    fetch(jobInfoUrl(jobdata.cluster, jobId), { redirect: "manual", cache: "no-store" }).then(res => {
      if (res.status === 0 && res.type === "opaqueredirect") {
        redirectToLogin();
        return Promise.reject(res);
      }
      if (!res.ok) {
        return Promise.reject(res);
      }
      return res.json();
    }).then(data => {
      const warningsDiv = $("<div>");
      const jobdata = row.data();

      if (isLowTimeEff(jobdata)) {
        warningsDiv.append(`
                    <div class="alert alert-warning mt-1 mb-2 shadow-sm" role="alert">
                        <i class="far fa-clock"></i> You requested <b>${moment.duration(jobdata.timelimit, "seconds").humanize()}</b> for this job but only used <b>${moment.duration(jobdata.elapsed, "seconds").humanize()}</b> (${jobdata.timeeff}%). Requesting less time will reduce your queue time and make more resources available for other users.
                    </div>
                    `);
      }
      if (isLowCPUMemEff(jobdata)) {
        warningsDiv.append(`
                    <div class="alert alert-warning mt-1 mb-2 shadow-sm" role="alert">
                        <i class="fas fa-memory"></i> You requested <b>${(jobdata.reqmem / (1024 ** 3)).toFixed(1)} GB</b> of CPU memory for this job but only used <b>${(jobdata.maxrss / (1024 ** 3)).toFixed(1)} GB</b> (${jobdata.memeff}%). Requesting less CPU memory/cores will reduce your queue time and make more resources available for other users.
                    </div>
                    `);
      }

      const panelDiv = $("<div>");
      const tableEl = $("<table>", { "class": "table table-bordered table-sm" });
      const tbodyEl = $("<tbody>");


      $.each(data, (key, val) => {
        const $td = $("<td>", { "class": "w-100" });

        if (key === "Working Directory") {
          const $copyButton = $("<button>", { "class": "btn btn-outline-secondary", "data-clipboard": val }).append($("<i>", { "class": "far fa-clipboard" }));
          $td.append($("<a>", { "href": `${filesPath()}${val}` }).append(val))
            .append(" ")
            .append($copyButton);
        } else if (key === "Session ID") {
          const $copyButton = $("<button>", { "class": "btn btn-outline-secondary", "data-clipboard": val }).append($("<i>", { "class": "far fa-clipboard" }));
          $td.append(val)
            .append(" ")
            .append($copyButton);
        } else {
          $td.append(val);
        }

        const $trEl = $("<tr>")
          .append($("<td>", { "class": "fw-bold text-nowrap" }).text(key))
          .append($td);
        tbodyEl.append($trEl);
      });

      tableEl.append(tbodyEl);
      panelDiv.append(tableEl);

      row.child(`
                <div id="details-panel-${jobId}" class="px-2">
                    ${warningsDiv.html()}
                    ${panelDiv.html()}
                </div>
                `).show();

      // should be able to initialize copy button(s)
      $("button[data-clipboard]").off("click").on("click", function () {
        const clipboardData = $(this).data("clipboard");
        navigator.clipboard.writeText(clipboardData).then(() => {
          toastr.success(`Copied "${clipboardData}" to clipboard!`);
        }).error(() => {
          toastr.error(`Failed to copy "${clipboardData}".`);
        });
      });
    }).catch(_error => {
      toastr.error(`Failed to load job info data for ${jobId}. Please try again later.`);
      row.child.hide();
    });
  }

  $("#close-job-details-button").attr("disabled", getExpandedRows().count() === 0);
}

// hide job details table
function hideJobDetails(row) {
  row.child.hide();
  $("#close-job-details-button").attr("disabled", getExpandedRows().count() === 0);
}

// toggle job details table and child row
function toggleJobDetails(row, showLoading = true, forceFetch = false) {
  if (row.child.isShown()) {
    hideJobDetails(row);
  } else {
    showJobDetails(row, showLoading, forceFetch);
  }
}

jQuery(() => {
  // TODO:
  // Show loading screen if Javascript is enabled

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

  const start = moment().subtract(7, 'days');
  const end = moment();

  initializePage(start, end);

  loadJobs(start, end);
});

// TODO: update #last-updated-text
