'use strict';

import { pageConfigData, clusterStatusUrl } from '../config.js';
import { getNodeState, getNodeStateName } from './util.js';
import { startTimestampUpdater } from '../utils.js';

const nodeShowUrl = (cluster, name) => {
  return pageConfigData().nodeShowUrl.replace('CLUSTER', cluster).replace('NAME', name);
}

let selectedStates = new Set();

function getNodeGroupName(node) {
  return node.NodeName.split("-")[0];
}

function formatMemory(memInMB) {
  // Convert string to number and handle invalid values
  const mem = Number(memInMB);
  if (!mem || isNaN(mem)) return '0 MB';

  // Use 1024 for binary conversion
  if (memInMB >= 1048576) { // 1024^2 (convert to TB)
    return `${(memInMB / 1048576).toFixed(2)} TB`;
  }
  if (memInMB >= 1024) { // convert to GB
    return `${(memInMB / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(memInMB)} MB`;
}

function renderNodeGroupFilters(nodeGroups) {
  const $filterGroupContainer = $('.filter-group[data-filter-name="group"]');
  $filterGroupContainer.html("");

  Object.keys(nodeGroups).forEach((groupName) => {
    const displayText = `${groupName.toUpperCase()} Nodes`;
    // Add option to mobile select
    const $toggleButton = $("<button>", {
      "class": "btn filter-toggle",
      "type": "button",
      "data-bs-toggle": "button",
      "data-group": groupName,
      "style": "--bs-btn-active-border-color: var(--bs-info);",
    })
      .append($("<i>", { "class": "text-info far fa-square" }))
      .append(displayText)
      .on("click", function () {
        const icon = $(this).children("i").first();
        if ($(this).hasClass("active")) {
          icon.attr("class", "text-info fas fa-check-square");
        } else {
          icon.attr("class", "text-info far fa-square");
        }
      });
    $filterGroupContainer.append($toggleButton);
  });
}

function renderHeatmap(data) {
  const nodesArray = Array.isArray(data) ? data : Object.values(data);

  // Group nodes by type
  const nodeGroups = nodesArray.reduce((groups, node) => {
    const groupName = getNodeGroupName(node);

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(node);
    return groups;
  }, {});

  // Render node group filters
  renderNodeGroupFilters(nodeGroups);

  // Re-render node grid
  const $heatmapContainer = $('#heatmap-container');
  $heatmapContainer.html("");
  $heatmapContainer.append(createNodeGrid(nodesArray));
  $heatmapContainer.append($("<div>", { "class": "d-none no-results text-center p-3 fs-5" }).text("No nodes with current filters."));

  // Initialize tooltips for the grid nodes
  $(".node-cell[data-bs-toggle='tooltip']").tooltip({
    trigger: 'hover',
    container: 'body'
  });
}

function createNodeGrid(nodes) {
  const $container = $('<div>', {
    "class": "row g-2",
  });

  const nodeElements = nodes.map(node => {
    const cluster = node.Cluster;
    const state = getNodeState(node);
    const nodeName = node.NodeName;

    const $nodeCellCol = $('<div>', {
      "class": "node-cell-col col-auto",
      "data-state": state,
      "data-cluster": cluster,
      "data-group": getNodeGroupName(node),
    });

    const $indicatorContainer = $("<div>", { "class": "indicator-container" });
    $indicatorContainer.append($("<div>", { "class": "cluster-indicator" }));
    $indicatorContainer.append($("<div>", { "class": "state-indicator" }));

    const $nodeCell = $("<a>", {
      "class": "node-cell btn",
      "data-bs-toggle": "tooltip",
      "data-bs-html": "true",
      "data-bs-custom-class": "node-cell-tooltip",
      "title": createNodeTooltip(node),
      "href": nodeShowUrl(cluster, nodeName),
    });
    $nodeCell.text(nodeName);

    $nodeCellCol.append($indicatorContainer);
    $nodeCellCol.append($nodeCell);
    return $nodeCellCol;
  });

  $container.append(nodeElements);

  return $container;
}

function createNodeTooltip(node) {
  const isGPUNode = parseInt(node.GPUTot) && parseInt(node.GPUTot) > 0;

  const cpuAlloc = parseInt(node.CPUAlloc) || 0;
  const cpuTotal = parseInt(node.CPUTot) || 0;
  const gpuLoad = parseInt(node.GPULoad) || 0;
  const gpuTotal = parseInt(node.GPUTot) || 0;

  const totalMem = parseInt(node.RealMemory) || 0;
  const allocMem = parseInt(node.AllocMem) || 0;

  const partitions = node.Partitions || [];

  const nodeState = getNodeStateName(node);
  const stateColor = nodeState.startsWith('Online') ? 'success' :  // Both Online states use success
    nodeState === 'Drained' ? 'warning' :
      nodeState === 'Maintenance' ? 'orange' : 'danger';

  return `
      <div class="text-start">
        <strong>${node.NodeName}</strong><br>
        <span class="text-${stateColor}">
          ${nodeState}
        </span><br>
        ${isGPUNode ? `<strong>GPUs</strong>: ${gpuLoad}/${gpuTotal}<br>` : `<strong>CPUs</strong>: ${cpuAlloc}/${cpuTotal}<br>`}
        <strong>Memory</strong>: ${formatMemory(allocMem)}/${formatMemory(totalMem)}<br>
        <strong>Partitions</strong>: ${partitions.join(', ')}
      </div>
    `;
}

function renderListView(data) {
  const datatable = $("#node-list").DataTable();
  datatable.clear();
  datatable.rows.add(data);
  datatable.draw();
}

async function loadClusterStatus() {
  $('.refresh-btn i').addClass('refresh-spin');

  // Clear selected states when refreshing
  selectedStates.clear();
  document.querySelectorAll('.status-selector').forEach(indicator => {
    indicator.classList.remove('selected');
  });

  fetch(clusterStatusUrl(), { cache: "no-store" })
    .then(res => res.json())
    .then(data => {
      // Store the current time as the last update time
      window.lastUpdatedTime = new Date();

      // Update both views
      renderHeatmap(data);
      renderListView(data);

      // Initialize status filters
      initializeFilters();

      $("#grid-list-tabs").removeClass("d-none");
      $(".card-body").removeClass("d-none");
      $(".error-div").addClass("d-none");

      return data;
    })
    .catch(error => {
      $("#grid-list-tabs").addClass("d-none");
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

function handleFilterChange() {
  let filters = {};
  $.each($(".filter-group"), (_index, filterGroup) => {
    const filterName = filterGroup.dataset.filterName;
    filters[filterName] = new Set();
    const activeFilters = $(filterGroup).children(".active");
    $.each(activeFilters, (_index, filterButton) => {
      filters[filterName].add(filterButton.getAttribute(`data-${filterName}`));
    });
  });

  $(".node-cell-col").removeClass("d-none");

  Object.entries(filters).forEach(([filterName, values]) => {
    if (values.size === 0) {
      return;
    }
    const selector = [...values].reduce((acc, value) => {
      return `${acc}.node-cell-col:not([data-${filterName}="${value}"])`
    }, "");
    $(selector).addClass("d-none");
  });
  const shownCount = $(".node-cell-col:not(.d-none)").length;
  $(".no-results").toggleClass("d-none", shownCount !== 0);
}

function initializeFilters() {
  $.each($(".filter-group"), (_index, element) => {
    $(element).children(".filter-toggle").on("click", handleFilterChange);
  });
}

function initializeListViewDataTable() {
  $("#node-list").DataTable({
    paging: false,
    scrollY: "50rem",
    columns: [
      {
        title: "Cluster",
        data: "Cluster",
        render: function (cluster, _type, _node, _meta) {
          return $("<span>", {
            "class": "badge cluster-badge rounded-pill",
            "data-cluster": cluster,
          }).text(cluster.toUpperCase())[0].outerHTML;
        },
      },
      {
        title: "Node",
        data: "NodeName",
        render: function (nodeName, _type, _node, _meta) {
          return $("<a>", {
            "href": nodeShowUrl(nodeName),
          }).text(nodeName)[0].outerHTML;
        },
      },
      {
        title: "State",
        data: "State",
        render: function (_state, _type, node, _meta) {
          return $("<span>", {
            "class": "badge state-badge rounded-pill",
            "data-state": getNodeState(node),
          }).text(getNodeStateName(node))[0].outerHTML;
        },
      },
      {
        title: "Partitions",
        data: "Partitions",
        render: function (partitions, _type, _node, _meta) {
          const badges = partitions.reduce((acc, partition) => {
            return acc + $("<span>", {
              "class": "badge partition-badge rounded-pill",
            }).text(partition)[0].outerHTML;
          }, "");
          return `<div class="d-flex gap-1">${badges}</div>`;
        },
      },
      {
        title: "CPU Cores (Used/Total)",
        data: "CPUAlloc",
        render: function (coresUsed, _type, node, _meta) {
          const used = coresUsed || 0;
          const total = node.CPUTot || 1;
          const $progressBar = $("<div>", { "class": "progress" })
            .append($("<div>", { "class": "progress-bar", "style": `width: ${used / total * 100}%` }));

          const $progressText = $("<span>", { "class": "progress-text" }).text(`${used}/${total} CPU Cores`);
          return $progressBar[0].outerHTML + $progressText[0].outerHTML;
        },
      },
      {
        title: "Memory (Used/Total)",
        data: "AllocMem",
        render: function (memoryUsed, _type, node, _meta) {
          const used = memoryUsed || 0;
          const total = node.RealMemory || 1;
          const $progressBar = $("<div>", { "class": "progress" })
            .append($("<div>", { "class": "progress-bar", "style": `width: ${used / total * 100}%` }));

          const $progressText = $("<span>", { "class": "progress-text" }).text(`${formatMemory(used)}/${formatMemory(total)}`);
          return $progressBar[0].outerHTML + $progressText[0].outerHTML;
        },
      },
    ],
  });
}

// Initialize tooltips and handle window resize
jQuery(() => {
  initializeListViewDataTable();
  $('.refresh-btn').on('click', loadClusterStatus);

  // Initialize all tooltips that already exist
  $('[data-bs-toggle="tooltip"]').tooltip({
    trigger: 'hover',
    container: 'body'
  });

  // Start the timestamp updater
  startTimestampUpdater();

  // This will manage loading any tooltips it creates
  loadClusterStatus();
});
