import { getNodeState } from './cluster_status/util.js';
import { pageConfigData, jobPathUrl } from './config.js';

import { clusterBadge, jobStateBadge, startTimestampUpdater } from './utils.js';

const cluster = () => { return pageConfigData().cluster; };
const nodeName = () => { return pageConfigData().nodeName; };
const nodeApiUrl = () => { return pageConfigData().nodeApiUrl; };

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

function formatDate(dateStr) {
  if (!dateStr || ['None', 'N/A', 'Unknown'].includes(dateStr)) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString();
  } catch (e) {
    return dateStr;
  }
};


function renderGeneralInfo(data) {
  // status card
  $("#statusText")
    .empty()
    .append($("<div>", { "class": "status-box me-2", "data-state": getNodeState(data) }))
    .append(data.State)
    .removePlaceholder();
  $("#lastActive")
    .text(`Last Active: ${formatDate(data.LastBusyTime)}`)
    .removePlaceholder();
  $("#clusterBadge").replaceWith(clusterBadge(cluster()));

  // resources card
  const cpuTotal = data.CPUTot || data.CPUs || 0;
  const cpuUsagePercent = cpuTotal ? Math.round((data.CPUAlloc / cpuTotal) * 100) : 0;
  const memUsagePercent = Math.round((data.AllocMem / data.RealMemory) * 100);
  const gpuUsagePercent = Math.round((data.gpu_info.allocated / data.gpu_info.total) * 100);
  const $barContainer = $("#resourcesBars").empty();
  $barContainer.append(
    createResourceBar("CPU Usage", `${data.CPUAlloc || 0}/${cpuTotal}`, cpuUsagePercent),
    createResourceBar("Memory Usage", `${formatMemory(data.AllocMem || 0)}/${formatMemory(data.RealMemory || 0)}`, memUsagePercent),
  );

  if (data.gpu_info.total != 0) {
    $barContainer.append(
      createResourceBar("GPU Usage", `${data.gpu_info.allocated}/${data.gpu_info.total}`, gpuUsagePercent)
    );
  }
}

function createResourceBar(title, text, width) {
  return $("<div>", { "class": "col" }).append(
    $("<label>", { "class": "d-flex justify-content-between" })
      .append($("<span>").text(title))
      .append($("<span>").text(text)),
    $("<div>", { "class": "progress" })
      .append(
        $("<div>", { "class": "progress-bar bg-success", "role": "progressbar" })
          .css("width", `${width}%`)),
  );
}

function renderNodeData(data) {
  renderGeneralInfo(data);

  const datatable = $("#jobsTable").DataTable();
  datatable.clear();
  datatable.rows.add(data.job_info.jobs);
  datatable.draw();
}

function initializeJobsDataTable() {
  $("#jobsTable").DataTable({
    columns: [
      {
        title: "Job ID",
        data: "job_id",
        render: function (jobId, _type, job, _meta) {
          return $("<a>", { "href": jobPathUrl(job.cluster, jobId) }).text(jobId)[0].outerHTML;
        },
      },
      { title: "Name", data: "name" },
      { title: "User", data: "user_name" },
      { title: "Partition", data: "partition" },
      { title: "Nodes", data: "job_resources.nodes.count", type: "string" },
      { title: "State", data: "job_state[0]", render: jobStateBadge },
      {
        title: "GPUs",
        data: function (row, _type, _set, _meta) {
          const treses = row.tres_req_str.split(",");
          const gpu_tres = treses.find(tres => {
            return tres.startsWith("gres/gpu=")
          });
          if (gpu_tres === undefined) {
            return 0;
          } else {
            return gpu_tres.split("=")[1];
          }

        },
        type: "string"
      },
      {
        title: "CPU Cores",
        data: function (row, _type, _set, _meta) {
          const job_node_info = row.job_resources.nodes.allocation;
          const node_info = job_node_info.find(node_info => {
            return node_info.name === nodeName();
          });
          return node_info.cpus.count;
        },
        type: "string"
      },
      {
        title: "Memory",
        data: function (row, _type, _set, _meta) {
          const job_node_info = row.job_resources.nodes.allocation;
          const node_info = job_node_info.find(node_info => {
            return node_info.name === nodeName();
          });
          return node_info.memory.allocated;
        },
        render: formatMemory
      },
      {
        title: "Time",
        data: function (row, _type, _set, _meta) {
          if (!row.start_time.set) {
            return 0;
          }
          const timeSinceStart = Math.round(Date.now() / 1000) - row.start_time.number;
          const timeTillEnd = row.end_time.number - row.start_time.number;
          const durationMs = Math.min(timeSinceStart, timeTillEnd);
          return durationMs;
        },
        render: function (time_secs, _type, _job, _meta) {
          const hours = Math.floor(time_secs / 60 / 60);
          const minutes = Math.floor(time_secs / 60) - hours * 60;
          const seconds = time_secs % 60;
          return new Intl.DurationFormat("en", { style: "digital" }).format({ hours: hours, minutes: minutes, seconds: seconds });
        }
      },
      {
        title: "Timelimit",
        data: "time_limit.number",
        render: function (time_mins, _type, _job, _meta) {
          const hours = Math.floor(time_mins / 60);
          const minutes = time_mins % 60;
          return new Intl.DurationFormat("en", { style: "digital" }).format({ hours: hours, minutes: minutes });
        }
      },
    ],
    drawCallback: function (_settings) {
      $('.dt-column-title:contains("CPU Cores")').parent().attr("title", "CPU Cores allocated by job on this node");
      $('.dt-column-title:contains("Memory")').parent().attr("title", "Memory allocated by job on this node");
    },
  });
}

async function loadNodeData() {
  $('.refresh-btn i').addClass('refresh-spin');

  fetch(nodeApiUrl(), { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);

      window.lastUpdatedTime = new Date();

      renderNodeData(data);

      // Re-initialize tooltips after any dynamic updates
      $('[data-bs-toggle="tooltip"]')
        .tooltip('dispose')
        .tooltip({ boundary: 'window' });
      $(".card-body").removeClass("d-none");
    })
    .catch(error => {
      $(".card-body").addClass("d-none");
      $(".error-div").removeClass("d-none");
      console.error('Error:', error);
      throw error;
    })
    .finally(() => {
      $(".loading-div").addClass("d-none");
      $('.refresh-btn i').removeClass('refresh-spin');
    });
}

// Initial load with loading animation
jQuery(() => {
  initializeJobsDataTable();
  $('[data-bs-toggle="tooltip"]').tooltip({
    trigger: 'hover',
    container: 'body'
  });
  startTimestampUpdater();

  loadNodeData();
  $("button.refresh-btn").on("click", loadNodeData);
});
