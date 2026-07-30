'use strict';

import { Chart, BarController, BarElement, Title, Legend, CategoryScale, LinearScale, Tooltip } from 'chart.js';
// import Chart from 'chart.js/auto';
import ChartPluginStacked100 from 'chartjs-plugin-stacked100';
Chart.register(BarController, BarElement, Title, Legend, ChartPluginStacked100, CategoryScale, LinearScale, [Tooltip]);

import moment from 'moment-timezone';
import daterangepicker from 'daterangepicker';
import toastr from 'toastr';

import { pageConfigData, jobPathUrl, filesPath, cancelJobsPath, username, csrfToken } from './config.js';

const myJobsUrl = () => { return pageConfigData()["myJobsUrl"] };
const jobInfoUrl = (id) => { return pageConfigData()["jobInfoUrl"].replace("JOB_ID", id) };

window.csrf_token = csrfToken();

const isLowTimeEff = (rowData) => (rowData[getColIndex("State")] === "COMPLETED" || rowData[getColIndex("State")] === "TIMEOUT") && rowData[getColIndex("Time Efficiency")] < TIME_EFF_THRESHOLD;
const isLowCPUMemEff = (rowData) => (rowData[getColIndex("State")] === "COMPLETED" || rowData[getColIndex("State")] === "TIMEOUT") && rowData[getColIndex("Memory Efficiency")] < MEM_EFF_THRESHOLD;

var TABLE_COLUMNS = [
  {
    orderable: true,
    orderSequence: ["asc", ""],
    render: $.fn.dataTable.render.select(),
    className: "border-right align-text-top"
  },
  {
    className: 'dt-control',
    orderable: false,
    data: null,
    defaultContent: ''
  },
  {
    title: "Job ID",
    field: "jobid",
    className: "text-nowrap",
    render: (data, _type, _row) => {
      return `<a href="${jobPathUrl(data)}" class="job - id - link">${data}</a>`;
    }
  },
  {
    title: "Job Name",
    field: "jobname",
    render: (data, _type, row) => {
      let linkToSession = "";
      if (row[getColIndex("Session ID")] !== "N/A") {
        linkToSession = `
                        (<a href="${filesPath}${row[getColIndex("Working Directory")]}">${row[getColIndex("Session ID")]}</a>)
                    `;
      }
      let efficiencyWarning = "";
      if (isLowTimeEff(row) || isLowCPUMemEff(row)) {
        efficiencyWarning = `
                        <i role="button" class="efficiency-warning fa fa-warning text-warning" data-bs-toggle="tooltip" title="You requested significantly more resources than you used. Click to learn more."></i>
                    `;
      }
      return `<span class="text-nowrap">${data + linkToSession + efficiencyWarning}</span>`
    }
  },
  {
    title: "User",
    field: "user",
    render: (data, _type, _row) => `<span class="user-filter" style="${data === username() ? "text-decoration: underline;" : ""}">${data}</span>`,
  },
  {
    title: "Account",
    field: "account",
    render: (data, _type, _row) => `<span class="account-filter">${data}</span>`,
    filterType: "multiselect",
  },
  {
    title: "Start Time",
    field: "start",
    render: (data, _type, _row) => {
      const timestamp = moment.unix(data);
      return timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--";
    },
  },
  {
    title: "End Time",
    field: "end",
    render: (data, _type, _row) => {
      const timestamp = moment.unix(data);
      return timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--";
    },
  },
  {
    title: "Time Used",
    field: "elapsed",
    render: (data, _type, row) => {
      if (row[getColIndex("Start Time")] !== "N/A" && row[getColIndex("End Time")] === "N/A") {
        return secondsToTimestr(moment().diff(moment.unix(row[getColIndex("Start Time")]), 'seconds'));
      }
      return secondsToTimestr(data);
    }
  },
  {
    title: "Submit Time",
    field: "submit",
    render: (data, _type, _row) => {
      const timestamp = moment.unix(data);
      return timestamp.isValid() ? timestamp.format("M/DD/YY HH:mm") : "--";
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Wait Time",
    field: "planned",
    render: (data, _type, _row) => {
      return secondsToTimestr(data);
    },
  },
  /* {
   *     title: "Used GPU Hours",
   *     field: "used_gpu_hours",
   *     visible: true,
   *     searchable: false,
   *     render: $.fn.dataTable.render.number(null, null, 4, "", ""),
   * }, */
  /* {
   *     title: "Required GPU Hours",
   *     field: "required_gpu_hours",
   *     visible: false,
   *     searchable: false,
   * }, */
  {
    title: "Time Efficiency",
    field: "timeeff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "CPU Efficiency",
    field: "cpueff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "Memory Efficiency",
    field: "memeff",
    render: $.fn.dataTable.render.number(null, null, 2, "", "%"),
    visible: false,
    searchable: false,
  },
  {
    title: "Partition",
    field: "partition",
    render: (data, _type, _row) => `<span class="partition-filter">${data}</span>`,
    filterType: "multiselect",
  },
  {
    title: "QOS",
    field: "qos",
    render: (data, _type, _row) => `<span class="qos-filter">${data}</span>`,
    filterType: "multiselect",
  },
  {
    title: "State",
    field: "state",
    render: (data, _type, row) => {
      var state_verbose = (SIMPLE_JOB_STATE_CODES[data.split(" ")[0]] || JOB_STATE_CODES[data.split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
      var reason_verbose = (SIMPLE_JOB_REASON_CODES[row[getColIndex("Reason")].split(" ")[0]] || JOB_REASON_CODES[row[getColIndex("Reason")].split(" ")[0]] || "--").replaceAll(/"/g, "&quot;");
      return `<a
                            class="job-state-filter badge text-bg-primary p-2 shadow-sm" 
                            style="font-size: 14px; color: ${JOB_STATE_COLORS[data.split(" ")[0]]?.fg}; background-color: ${JOB_STATE_COLORS[data.split(" ")[0]]?.bg};" 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="top" 
                            title="${state_verbose + (row[getColIndex("Requeue Count")] ? `\nRequeued ${row[getColIndex("Requeue Count")]} time(s)` : "")}">
                        ${data + (row[getColIndex("Requeue Count")] ? ` (${row[getColIndex("Requeue Count")]})` : "")}
                    </a>` +
        (row[getColIndex("Reason")] !== "None" && reason_verbose !== "--" ?
          `<span class="text-nowrap"> due to
                            <span 
                                class="job-reason-filter badge rounded-pill text-bg-secondary shadow-sm"
                                style="font-size: 0.9rem;"
                                data-bs-toggle="tooltip" 
                                data-bs-placement="top" 
                                title="${reason_verbose}">
                                ${row[getColIndex("Reason")]}
                            </span>
                        </span>`
          : "");
    },
    filterType: "multiselect",
  },
  {
    title: "Reason",
    field: "reason",
    visible: false,
    searchable: false,
  },
  {
    title: "Total Time",
    field: "timelimit",
    render: (data, _type, _row) => {
      return secondsToTimestr(data);
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Requested Memory",
    field: "reqmem",
    visible: false,
    searchable: false,
  },
  {
    title: "Allocated CPU Count",
    field: "alloccpus",
    visible: false,
    searchable: false,
  },
  {
    title: "Total CPU Time",
    field: "totalcpu",
    render: (data, _type, _row) => {
      return secondsToTimestr(data);
    },
    visible: false,
    searchable: false,
  },
  {
    title: "Working Directory",
    field: "workdir",
    visible: false,
    searchable: false,
  },
  {
    title: "Session ID",
    field: "sessionid",
    visible: false,
    searchable: false,
  },
  {
    title: "Requeue Count",
    field: "requeue_count",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Used Memory",
    field: "maxrss",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Disk Write",
    field: "maxdiskwrite",
    visible: false,
    searchable: false,
  },
  {
    title: "Max Disk Read",
    field: "maxdiskread",
    visible: false,
    searchable: false,
  },
  {
    title: "Nodes",
    field: "nodelist",
    visible: false,
    render: (data, _type, _row) => {
      return data !== "N/A" ? data : "--"
    },
    filterType: "multiselect",
  },
  {
    title: "Requested Resources",
    field: "reqtres",
    visible: false,
    searchable: false,
  },
  {
    title: "_timestamp",
    field: "timestamp",
    visible: false,
    searchable: false,
  },
  {
    title: "Actions",
    searchable: false,
    orderable: false,
    render: (_data, _type, row) => {
      let nodes = row[getColIndex("Nodes")].split(",");
      return `
                <div id="job-actions-group" class="d-flex justify-content-between" aria-label="Job Actions">
                    <button class="cancel-job-button btn btn-sm btn-danger shadow-none mx-1 ${!(row[getColIndex("User")] === "${username()}" && ["RUNNING", "PENDING", "SUSPENDED"].includes(row[getColIndex("State")])) ? "d-none" : ""}" title="Cancel This Job">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div class="btn-group ${!(row[getColIndex("User")] === "${username()}" && row[getColIndex("State")] === "RUNNING") ? "d-none" : ""}">
                        <button class="connect-to-job-button btn btn-sm btn-info shadow-none" title="Copy Connect to Job Shell Command">
                            <i class="fas fa-plug"></i>
                        </button>
                        <button type="button" class="btn btn-sm btn-info shadow-none dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <span class="visually-hidden">Toggle Dropdown</span>
                        </button>
                        <div class="dropdown-menu">
                            ${nodes.map((node) => {
        return `<button class="dropdown-item connect-to-node-button">${node}</button>`
      }).join("\n")}
                        </div>
                    </div>
                </div>
                `;
    },
  },
];

// These are to make sure we aren't simultaneously running multiple instances of job refresh or cancellation code
var refreshJobMutex = true;
var cancelJobsMutex = false;
var confirmModalMutex = false;

// Maximum number of charts shown on screen at one time
var MAX_NUM_CHARTS = 2;

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
    config: {
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
    },
  },
];

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

const getCancelJobButtonText = () => `<span><i class="fas fa-trash-alt"></i> Cancel ${getSelectedRows().count()} job(s)</span>`;

function extractTableData(data) {
  return data.map(d => TABLE_COLUMNS.map((col, _i) => d.hasOwnProperty(col.field) ? d[col.field] : ""));
}

// First time loading job list on page load
function loadJobs() {
  refreshJobMutex = true;
  // Use cached job data initially so the user sees something, then use refreshJobs() to load the updated data
  fetch(myJobsUrl(), { redirect: "manual" }).then(res => {
    if (res.status === 0 && res.type === "opaqueredirect") {
      redirectToLogin();
      return Promise.reject(res);
    }
    if (!res.ok) {
      return Promise.reject(res);
    }
    return res.json();
  }).then(data => {
    // Create data tables
    $('#my-jobs-table').DataTable({
      scrollX: true,
      pageLength: 10,
      fixedHeader: true,
      rowId: (data) => data[getColIndex("Job ID")],
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
      orderFixed: {
        post: [getColIndex("_timestamp"), 'desc'],
      },
      order: [
        [getColIndex("_timestamp"), 'desc'],
      ],
      layout: {
        top: () => {
          let nav = document.createElement('nav');
          nav.innerHTML = `
                            <nav class="nav px-0">
                                <div class="d-flex align-items-center mb-auto mt-1">
                                    <select id="page-length-select" class="form-select form-select-sm me-2 my-1 w-auto shadow-none bg-transparent" style="color: inherit;">
                                        <option value="10" selected>10</option>
                                        <option value="15">15</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="-1">All</option>
                                    </select>
                                    jobs per page
                                </div>

                                <div class="mx-auto">
                                    <div class="row" id="main-table-buttons">
                                        <div class="col">
                                            <button id="cancel-selected-jobs-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;" disabled>
                                                ${getCancelJobButtonText()}
                                            </button>
                                            <button id="refresh-jobs-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;">
                                                <i class="fa fa-refresh"></i> Refresh
                                            </button>
                                            <button id="reset-filters-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;">
                                                <i class="fas fa-undo"></i> Reset Filters
                                            </button>
                                            <button id="toggle-efficiency-columns-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;">
                                                <i class="fas fa-tachometer-alt"></i> Toggle Efficiency Data
                                            </button>

                                            <button class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;" type="button" data-bs-toggle="collapse" data-bs-target="#more-table-buttons" aria-expanded="false" aria-controls="more-table-buttons">
                                                <i class="fa fa-bars"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="collapse" id="more-table-buttons" style="transition: height .30s ease;">
                                        <div class="row">
                                            <div class="col">
                                                <button id="toggle-table-size-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;">
                                                    <i class="fa fa-th"></i> Toggle Table Size
                                                </button>
                                                <div class="dropdown d-inline-block">
                                                    <button id="export-data-dropdown-button" class="btn dropdown-toggle shadow-sm m-1" style="background-color: #ddb945; color: black;" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <i class="fas fa-file-export"></i> Export as
                                                    </button>
                                                    <div class="dropdown-menu" aria-labelledby="export-data-dropdown-button">
                                                        <button class="dropdown-item">CSV</button>
                                                        <button class="dropdown-item">Excel</button>
                                                    </div>
                                                </div>
                                                <button id="close-job-details-button" class="btn shadow-sm m-1" style="background-color: #ddb945; color: black;" disabled>
                                                    <i class="fas fa-times"></i> Close Job Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <form class="d-flex align-items-center mb-auto mt-1">
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="checkbox" id="regex-search-toggle">
                                        <label class="form-check-label" for="regex-search-toggle" title="When checked, use regular expressions. (i.e. type 'cancelled|running' to filter by both cancelled and running jobs)" data-bs-toggle="tooltip">Regex?</label>
                                    </div>
                                    <input class="form-control shadow-none m-1 bg-transparent" id="my-jobs-search" type="search" placeholder="Search" aria-label="Search" style="color: inherit;">
                                </form>
                            </nav>
                        `;
          return nav;
        },
        topStart: null,
        topEnd: null,
        bottomStart: "info",
        bottomEnd: "paging",
      },
      columns: TABLE_COLUMNS,
      data: extractTableData(data),
    });

    // Selected jobs text display
    getCurrentTable().on("select deselect", () => {
      $("#cancel-selected-jobs-button").attr("disabled", getSelectedRows().count() === 0);
      $("#cancel-selected-jobs-button").html(getCancelJobButtonText());
    });

    getCurrentTable().on("order", () => {
      if (getCurrentTable().order().toString?.() === "0,") {
        getCurrentTable().order([[getColIndex("_timestamp"), 'desc']]).draw();
      }
    });

    getCurrentTable().on("search", () => {
      $('[data-bs-toggle="tooltip"]').tooltip('dispose');
      enableTooltips();
    });

    function refreshColumnFilters() {
      /* https://datatables.net/examples/api/multi_filter_select.html */
      getCurrentTable().columns().every(function () {
        let column = this;

        if (TABLE_COLUMNS[getColIndex(column.title())]?.filterType === "multiselect") {
          let select = column.header().querySelector("select");
          if (!select) {
            select = document.createElement('select');

            select.addEventListener('click', function (e) {
              e.stopPropagation();
            });

            select.addEventListener('mousedown', function (e) {
              e.stopPropagation();
            });

            select.addEventListener('focus', function (e) {
              e.stopPropagation();
            });

            select.addEventListener('change', function () {
              // For State column, use custom filtering logic
              if (column.title() === "State") {
                // First, always clear any existing state filters
                $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(function (fn) {
                  return fn.toString().indexOf('stateFilterForMyJobs') === -1;
                });

                if (select.value) {
                  const selectedState = select.value;

                  // Use a custom search function that looks at raw data
                  function stateFilterForMyJobs(settings, _data, dataIndex) {
                    // Only apply this filter to our table
                    if (settings.nTable.id !== 'my-jobs-table') {
                      return true;
                    }

                    // Get the raw state data for this row
                    const rowData = getCurrentTable().row(dataIndex).data();
                    const stateValue = rowData[getColIndex("State")];
                    const firstWord = stateValue.split(" ")[0];

                    return firstWord === selectedState;
                  }

                  $.fn.dataTable.ext.search.push(stateFilterForMyJobs);
                  getCurrentTable().draw();
                } else {
                  getCurrentTable().draw();
                }
              } else {
                column.search(select.value, { exact: true }).draw();
              }
            });
          }

          const oldValue = select.value || '';

          select.innerHTML = '';

          select.add(new Option(''));

          // For State column, extract first word only for filter options
          if (column.title() === "State") {
            let stateWords = new Set();
            column.data().each(function (d, _j) {
              const firstWord = d.split(" ")[0];
              stateWords.add(firstWord);
            });
            const sortedStates = Array.from(stateWords).sort();
            sortedStates.forEach(function (state) {
              select.add(new Option(state));
            });
          } else {
            column
              .data()
              .unique()
              .sort()
              .each(function (d, _j) {
                select.add(new Option(d));
              });
          }

          select.value = oldValue;
          // For State column, use custom filtering logic
          if (column.title() === "State" && oldValue) {
            // Clear any existing state filters first
            $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(function (fn) {
              return fn.toString().indexOf('stateFilterForMyJobs') === -1;
            });

            const restoredState = oldValue;

            // Use the same custom search function
            function stateFilterForMyJobs(settings, _data, dataIndex) {
              // Only apply this filter to our table
              if (settings.nTable.id !== 'my-jobs-table') {
                return true;
              }

              // Get the raw state data for this row
              const rowData = getCurrentTable().row(dataIndex).data();
              const stateValue = rowData[getColIndex("State")];
              const firstWord = stateValue.split(" ")[0];

              return firstWord === restoredState;
            }

            $.fn.dataTable.ext.search.push(stateFilterForMyJobs);
            getCurrentTable().draw();
          } else {
            column.search(oldValue, { exact: true }).draw();
          }
          let brEl = column.header().querySelector("select");
          if (!brEl) {
            brEl = document.createElement("br");
            column.header().append(brEl);
          }
          column.header().append(select);
        }
      });
    }

    // Autofocus search input when typing
    $(document).on("keypress", function (e) {
      var char = String.fromCharCode(e.which);
      if (char.match(/[^\x00-\x1F]/)) {
        $('#my-jobs-search').focus();
      }
    });

    // Don't try to submit when pressing enter while search input is focused
    $(window).keydown(function (event) {
      if (event.keyCode == 13) {
        event.preventDefault();
        return false;
      }
    });

    // Custom page length menu
    $("#page-length-select").on("change", (e) => {
      getCurrentTable().page.len(e.target.value).draw();
    });

    setupPerRowEventListeners();

    refreshColumnFilters();

    // Custom table search
    $("#my-jobs-search, #regex-search-toggle").on("input", function () {
      let useRegex = $("#regex-search-toggle").is(":checked");
      getCurrentTable().search($("#my-jobs-search").val(), useRegex, !useRegex).draw();
    });

    $("#close-job-details-button").on("click", () => {
      getCurrentTable().rows().every(function () {
        if (this.child.isShown()) {
          this.child.hide();
        }
      });
      $("#close-job-details-button").attr("disabled", true);
    });

    // Toggle between compact and comfortable table layout
    $("#toggle-table-size-button").on("click", () => {
      $("#my-jobs-table").toggleClass("table-sm");
      getCurrentTable().columns.adjust().draw();
    });

    function confirmModal(modalTitle, modalMsg) {
      if (confirmModalMutex) {
        toastr.error("Error showing modal. Please try again.");
        return false;
      }

      confirmModalMutex = true;

      return new Promise((resolve, _reject) => {
        // Create modal structure
        const modalHTML = `
                    <div class="modal" id="confirm-modal" tabindex="-1" role="dialog">
                        <div class="modal-dialog" role="document">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">${modalTitle}</h5>
                                    <button type="button" class="close close-btn" data-bs-dismiss="modal" aria-label="Close">
                                    
                                    </button>
                                </div>
                                ${modalMsg ? `
                                <div class="modal-body">
                                    ${modalMsg}
                                </div>
                                ` : ""}
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-danger" id="confirm-btn">Confirm</button>
                                    <button type="button" class="btn btn-secondary close-btn" data-bs-dismiss="modal">Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show the modal
        $('#confirm-modal').modal('show');

        // Handle confirm action
        $('#confirm-modal #confirm-btn').on('click', function () {
          // Resolve the promise with true
          resolve(true);
          $('#confirm-modal').modal('hide');
        });

        // Handle close action
        $('#confirm-modal .close-btn').on('click', function () {
          // Resolve the promise with false
          resolve(false);
          $('#confirm-modal').modal('hide');
        });

        // Clean up the modal from the DOM after hiding
        $('#confirm-modal').on('hidden.bs.modal', function () {
          $(this).remove();
          confirmModalMutex = false;
        });
      });
    }

    // Interactively cancel jobs with ids in jobIds array
    function cancelJobs(jobIds, deselectOnSuccess = true, noJobsMsg = "No jobs were selected", failedMsg = "Failed to cancel jobs") {
      $("#cancel-selected-jobs-button").attr("disabled", true);
      $(".cancel-job-button").attr("disabled", true);

      if (cancelJobsMutex) {
        toastr.info("Currently cancelling jobs. Please wait.");
        return;
      }
      cancelJobsMutex = true;

      if (jobIds === 0) {
        toastr.warning(noJobsMsg);
        cancelJobsMutex = false;
        $("#cancel-selected-jobs-button").attr("disabled", getSelectedRows().count() === 0);
        $(".cancel-job-button").attr("disabled", false);
      } else {
        confirmModal(`Are you sure you want to cancel ${jobIds.length} job(s)?`, "").then(function (confirmed) {
          if (confirmed) {
            fetch(cancelJobsPath(), {
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
              refreshJobs(false);
            }).catch(_error => {
              toastr.error(failedMsg);
            }).finally(() => {
              setTimeout(() => {
                cancelJobsMutex = false;
                $("#cancel-selected-jobs-button").attr("disabled", getSelectedRows().count() === 0);
                $(".cancel-job-button").attr("disabled", false);
              }, 0.5 * 1000);
            });
          } else {
            toastr.info("Job(s) not cancelled due to user action");

            cancelJobsMutex = false;
            $("#cancel-selected-jobs-button").attr("disabled", getSelectedRows().count() === 0);
            $(".cancel-job-button").attr("disabled", false);
          }
        });
      }
    }

    // Cancel jobs button
    $("#cancel-selected-jobs-button").on("click", () => {
      cancelJobs(getSelectedRows().data().map(row => row[getColIndex("Job ID")]).toArray(), true);
    });

    // Export selected rows or all rows if none selected
    function exportData(type) {
      var EXPORT_TYPES = { "CSV": "csv", "Excel": "xlsx" };
      let exportedData = getSelectedRows().data();
      if (exportedData.length === 0) {
        exportedData = getCurrentTable().rows().data();
      }
      if (exportedData.length === 0) {
        toastr.error("No data to export");
      } else if (Object.keys(EXPORT_TYPES).includes(type)) {
        toastr.info(`Exporting ${exportedData.length} row(s) as ${type}...`);
        exportedData.unshift(TABLE_COLUMNS.map(col => col?.title || ""));
        const worksheet = XLSX.utils.aoa_to_sheet(exportedData);
        var workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, `my_jobs_${Date.now()}.${EXPORT_TYPES[type]}`, { compression: true });
      } else {
        toastr.error("Invalid export file type");
      }
    }

    // Export button
    $('div[aria-labelledby="export-data-dropdown-button"] .dropdown-item').on("click", function () {
      exportData($(this).text());
    });

    // Enable Bootstrap tabs
    $('#tablist a.nav-link').on('click', function (e) {
      e.preventDefault();
      $(this).tab('show');

      if ($(this).is("#allocation-jobs-tab")) {
        getCurrentTable().columns("User:title").search('').draw();
      } else if ($(this).is("#my-jobs-tab")) {
        getCurrentTable().columns("User:title").search(username()).draw();
      }
    });

    // Start on My Jobs tab
    getCurrentTable().columns("User:title").search(username()).draw();

    // Individual job details panel
    getCurrentTable().on("click", "td.dt-control", function () {
      let tr = $(this).closest("tr");
      let row = getCurrentTable().row(tr);

      toggleJobDetails(row);
    });

    // Individual job details panel
    getCurrentTable().on("click", "i.efficiency-warning", function () {
      let tr = $(this).closest("tr");
      let row = getCurrentTable().row(tr);

      showJobDetails(row);
    })

    // Initialize default selected chart
    refreshSelectedChart();

    $("#global-data-chart-toggle").on("input", function () {
      refreshSelectedChart();
    });

    // Enable tooltips when changing pages or filters
    getCurrentTable().on("draw", () => {
      $('[data-bs-toggle="tooltip"]').tooltip('dispose');
      enableTooltips();
      refreshSelectedChart();
      setupPerRowEventListeners();

      // This fixes a problem when fixedHeader and scrollX are used together
      // and the header gets drawn incorrectly when changing pages
      // or refreshing the table data
      getCurrentTable().fixedHeader.enable(false);
      getCurrentTable().fixedHeader.enable(true);
    });

    const initialStartDate = moment().subtract(7, 'days');
    const initialEndDate = moment();

    const refreshDatetimeRangeSelector = (start, end) => {
      const dateTimeFormat = "YYYY-MM-DD HH:mm z";
      const localTimeZone = moment.tz.guess();
      const startText = start.tz(localTimeZone).format(dateTimeFormat);
      const endText = end.tz(localTimeZone).format(dateTimeFormat);
      const newLabel = `<span class="text-nowrap">${startText}</span> to <span class="text-nowrap">${endText}</span>`;
      $("#datetime-range-selector #datetime-range-selector-text").html(newLabel);
    };

    $('#datetime-range-selector').daterangepicker({
      startDate: initialStartDate,
      endDate: initialEndDate,
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
      refreshJobs(true, start, end);
    });

    refreshDatetimeRangeSelector(initialStartDate, initialEndDate);

    // Make sure to enable tooltips after initializing table
    enableTooltips();

    function refreshJobs(manual, start = null, end = null) {
      if (refreshJobMutex) {
        return;
      }
      refreshJobMutex = true;

      if (start === null) {
        start = moment().subtract(7, 'days');
      }
      if (end === null) {
        end = moment();
      }

      $("#refresh-jobs-button").attr("disabled", true);
      $("#refresh-jobs-button").html('<i class="fa fa-refresh fa-spin"></i> Refresh');
      fetch(`${myJobsUrl}?start_time=${start.toISOString()}&end_time=${end.toISOString()}`, { redirect: "manual" }).then(res => {
        if (manual && res.status === 0 && res.type === "opaqueredirect") {
          redirectToLogin();
          return Promise.reject(res);
        }
        if (!res.ok) {
          return Promise.reject(res);
        }
        return res.json();
      }).then(data => {
        var expandedRows = getExpandedRows().data().pluck(getColIndex("Job ID")).toArray();
        var expandedRowsContent = {};
        expandedRows.forEach(function (jobId) {
          let row = getCurrentTable().row((_idx, data) => data[getColIndex("Job ID")] === jobId);
          expandedRowsContent[jobId] = $(row.child()[0], "td div");
        });
        var selectedRows = getSelectedRows().data().pluck(getColIndex("Job ID")).toArray();
        getCurrentTable().clear();
        getCurrentTable().rows.add(extractTableData(data));
        $('[data-bs-toggle="tooltip"]').tooltip('dispose');
        var scrollTop = $(window).scrollTop();
        getCurrentTable().draw(false);
        expandedRows.forEach(function (jobId) {
          let row = getCurrentTable().row((_idx, data) => data[getColIndex("Job ID")] === jobId);
          row.child(expandedRowsContent[jobId]).show();
        });
        expandedRows.forEach(function (jobId) {
          let row = getCurrentTable().row((_idx, data) => data[getColIndex("Job ID")] === jobId);
          showJobDetails(row, false, true);
        });
        getCurrentTable().rows(function (_idx, data, _node) {
          return selectedRows.includes(data[getColIndex("Job ID")]);
        }).select();
        if (getCurrentTable().order().toString?.() === "0,") {
          getCurrentTable().order([[getColIndex("_timestamp"), 'desc']]).draw();
        } else if (getCurrentTable().order().toString?.() === "0,asc") {
          getCurrentTable().order([[0, 'asc']]).draw();
        }
        $(window).scrollTop(scrollTop);
        $("#refresh-jobs-button").attr("disabled", false);
        $("#refresh-jobs-button").html('<i class="fa fa-refresh"></i> Refresh');
        $("#last-updated-text").text(`Last Updated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        enableTooltips();
        setupPerRowEventListeners();
        refreshColumnFilters();
      }).catch(_error => {
        // Do nothing if failed to refresh data

        $("#refresh-jobs-button").attr("disabled", false);
        $("#refresh-jobs-button").html('<i class="fa fa-refresh"></i> Refresh');
      });
      refreshJobMutex = false;
    }

    function setupPerRowEventListeners() {
      // Commenting the filters out because they may be unwieldy to use
      /*const filters = ["job-state", "job-reason", "queue", "account", "user"];
      filters.forEach(function(filter) {
          $(`.${filter}-filter`).off('click').on("click", function() {
              let text = $(this).text();
              toggleFilterText(text);
          });
      });*/

      $(".cancel-job-button").off('click').on("click", function (_e) {
        let tr = $(this).closest("tr");
        let row = getCurrentTable().row(tr);
        let jobId = row.data()[getColIndex("Job ID")];
        cancelJobs([jobId], false, "No jobs specified", "Failed to cancel job");
      });

      $(".connect-to-job-button").off('click').on("click", function (_e) {
        let tr = $(this).closest("tr");
        let row = getCurrentTable().row(tr);
        let jobId = row.data()[getColIndex("Job ID")];
        const shellCommand = `srun --pty --jobid ${jobId} $SHELL`;
        navigator.clipboard.writeText(shellCommand).then(function () {
          toastr.success('Copied command to clipboard');
        }, function () {
          toastr.error('Failed to copy command to clipboard. Check your clipboard permissions for this site.');
        });
      });

      $(".connect-to-node-button").off('click').on("click", function (_e) {
        let tr = $(this).closest("tr");
        let row = getCurrentTable().row(tr);
        let jobId = row.data()[getColIndex("Job ID")];
        let node = $(this).text();
        const shellCommand = `srun --pty --jobid ${jobId} -w ${node} $SHELL`;
        navigator.clipboard.writeText(shellCommand).then(function () {
          toastr.success('Copied command to clipboard');
        }, function () {
          toastr.error('Failed to copy command to clipboard. Check your clipboard permissions for this site.');
        });
      });
    }

    $("#refresh-jobs-button").on("click", () => {
      refreshJobs(true);
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

    /*setInterval(() => {
        refreshJobs(false);
    }, 60 * 1000); // refresh data every minute*/
    refreshJobMutex = false;

    // Load in updated job data
    refreshJobs();
  }).catch(error => {
    toastr.error("Failed to load my jobs data. Please try again later.");
    console.error(error);
  }).finally(() => {
    $("#my-jobs-loading-div").addClass("d-none");
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

  var jobId = row.data()[getColIndex("Job ID")];

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

    fetch(jobInfoUrl(jobId), { redirect: "manual" }).then(res => {
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

      if (isLowTimeEff(row.data())) {
        warningsDiv.append(`
                    <div class="alert alert-warning mt-1 mb-2 shadow-sm" role="alert">
                        <i class="far fa-clock"></i> You requested <b>${moment.duration(row.data()[getColIndex("Total Time")], "seconds").humanize()}</b> for this job but only used <b>${moment.duration(row.data()[getColIndex("Time Used")], "seconds").humanize()}</b> (${row.data()[getColIndex("Time Efficiency")]}%). Requesting less time will reduce your queue time and make more resources available for other users.
                    </div>
                    `);
      }
      if (isLowCPUMemEff(row.data())) {
        warningsDiv.append(`
                    <div class="alert alert-warning mt-1 mb-2 shadow-sm" role="alert">
                        <i class="fas fa-memory"></i> You requested <b>${(row.data()[getColIndex("Requested Memory")] / (1024 ** 3)).toFixed(1)} GB</b> of CPU memory for this job but only used <b>${(row.data()[getColIndex("Max Used Memory")] / (1024 ** 3)).toFixed(1)} GB</b> (${row.data()[getColIndex("Memory Efficiency")]}%). Requesting less CPU memory/cores will reduce your queue time and make more resources available for other users.
                    </div>
                    `);
      }

      const panelDiv = $("<div>");
      const tableEl = $(`<table class="table table-bordered table-sm"></table>`);
      const tbodyEl = $("<tbody></tbody>");

      $.each(data, (key, val) => {
        const trEl = $(`
                        <tr>
                            <td class="fw-bold text-nowrap">${key}</td>
                            <td class="w-100">${val}</td>
                        </tr>
                    `);
        tbodyEl.append(trEl);
      });

      tableEl.append(tbodyEl);
      panelDiv.append(tableEl);

      row.child(`
                <div id="details-panel-${jobId}" class="px-2">
                    ${warningsDiv.html()}
                    ${panelDiv.html()}
                </div>
                `).show();
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

  loadJobs();
});

// TODO: update #last-updated-text
// TODO: add cluster column
