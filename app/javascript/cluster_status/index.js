'use strict';

import { pageConfigData, clusterStatusUrl } from '../config.js';
import { getNodeState, getNodeStateName } from './util.js';

function nodeShowUrl(name = "__NAME__") {
  const cfgData = pageConfigData();
  return cfgData['nodeShowUrl'].replace('__NAME__', name);
}

let rawData = null;
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

  // After creating all tabs, update scroll indicators
  updateScrollIndicators();
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

  // Initialize tooltips for the grid nodes
  initializeGridTooltips();
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
      "title": createNodeTooltip(node),
      "href": nodeShowUrl(nodeName),
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

let searchTerm = '';

function nodeMatchesSearch(node, term) {
  if (!term) return true;

  term = term.toLowerCase();

  // Search in node name
  if (node.NodeName.toLowerCase().includes(term)) return true;

  // Search in state
  if (getNodeStateName(node).toLowerCase().includes(term)) return true;

  // Search in CPU info
  const cpuInfo = `${node.CPULoad || 0}/${node.CPUTot || 0}`;
  if (cpuInfo.includes(term)) return true;

  // Search in memory info
  const totalMem = parseInt(node.RealMemory) || 0;
  const freeMem = parseInt(node.FreeMem) || 0;
  const usedMem = totalMem - freeMem;
  const memInfo = `${formatMemory(usedMem)}/${formatMemory(totalMem)}`;
  if (memInfo.toLowerCase().includes(term)) return true;

  // Search in partitions
  if (node.Partitions && node.Partitions.some(partition =>
    partition.toLowerCase().includes(term)
  )) return true;

  return false;
}

function handleSearch(event) {
  searchTerm = event.target.value;

  // Get current group name
  const currentGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
    document.querySelector('.mobile-group-select').value;

  // Get nodes for current group
  let nodes;
  if (currentGroup === 'All Nodes') {
    nodes = rawData;
  } else {
    nodes = rawData.filter(node => {
      const prefix = node.NodeName.match(/^[a-z]+/i)?.[0] || 'other';
      const nodeGroupName = prefix === 'login' ? 'Login Nodes' :
        `${prefix.toUpperCase()} Nodes`;
      return nodeGroupName === currentGroup;
    });
  }

  // Apply search filter
  const filteredNodes = nodes.filter(node => nodeMatchesSearch(node, searchTerm));

  // Apply current sort if any
  const sortedNodes = currentSort.column ?
    sortNodes(filteredNodes, currentSort.column, currentSort.direction) :
    filteredNodes;

  // Render the filtered and sorted nodes
  renderListView(sortedNodes);
}

function renderListView(data) {
  const datatable = $("#node-list").DataTable();
  datatable.clear();
  datatable.rows.add(data);
  datatable.draw();
}

function formatLastUpdated() {
  const now = new Date();
  const lastUpdated = window.lastUpdatedTime || now;  // Use stored timestamp

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

function startTimestampUpdater() {
  // Clear any existing interval
  if (window.timestampInterval) {
    clearInterval(window.timestampInterval);
  }

  // Update timestamp every minute (60000 milliseconds)
  window.timestampInterval = setInterval(formatLastUpdated, 60000);
}

async function loadClusterStatus() {
  $('.refresh-btn i').addClass('refresh-spin');
  $("#error-div").addClass("d-none");

  // Clear selected states when refreshing
  selectedStates.clear();
  document.querySelectorAll('.status-selector').forEach(indicator => {
    indicator.classList.remove('selected');
  });

  fetch(clusterStatusUrl(), {cache: "no-store"}).then(res => {
    return res.json();
  })
    .then(data => {
      // Store the current time as the last update time
      window.lastUpdatedTime = new Date();

      // Update timestamp display and start auto-updating
      formatLastUpdated();
      startTimestampUpdater();

      rawData = data;

      // Update both views
      renderHeatmap(data);
      renderListView(data);

      // Initialize status filters
      initializeFilters();

      $("#grid-list-tabs").removeClass("d-none");
      $(".card-body").removeClass("d-none");

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

let currentSort = {
  column: null,
  direction: 'asc'
};

function getSortValue(node, column) {
  switch (column) {
    case 'name':
      return node.NodeName.toLowerCase();
    case 'state':
      // Create a priority order for states
      const statePriority = {
        'Down': 0,
        'Maintenance': 1,
        'Drained': 2,
        'Online': 3,
        'Available': 3,
        'Partially Allocated': 3,
        'Fully Allocated': 3
      };
      return statePriority[getNodeStateName(node)];
    case 'compute':
      // Handle both CPU and GPU sorting
      if (node.NodeName.startsWith('g')) {
        const gpuLoad = parseFloat(node.GPULoad) || 0;
        const gpuTotal = parseFloat(node.GPUTot) || 0;
        return gpuLoad / (gpuTotal || 1);
      } else {
        const cpuLoad = parseFloat(node.CPULoad) || 0;
        const cpuTotal = parseFloat(node.CPUTot) || 0;
        return cpuLoad / (cpuTotal || 1);
      }
    case 'memory':
      // Calculate memory usage percentage
      const totalMem = parseInt(node.RealMemory) || 0;
      const freeMem = parseInt(node.FreeMem) || 0;
      const usedMem = totalMem - freeMem;
      return usedMem / (totalMem || 1); // Return usage percentage
    case 'partitions':
      return (node.Partitions || []).sort().join(',').toLowerCase();
    default:
      return 0;
  }
}

function sortNodes(nodes, column, direction) {
  return [...nodes].sort((a, b) => {
    const aValue = getSortValue(a, column);
    const bValue = getSortValue(b, column);

    // Simple comparison that works for all types
    if (direction === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });
}

function initializeGridTooltips() {
  // First dispose any existing tooltips
  $('.node-cell[data-bs-toggle="tooltip"]').tooltip('dispose');

  // Initialize tooltips using event delegation
  $('#heatmap').on('mouseenter', '.node-cell', function () {
    const $this = $(this);
    if (!$this.data('tooltip-initialized')) {
      $this.tooltip({
        boundary: 'window',
        trigger: 'hover',
        placement: 'auto',
        container: 'body',
        template: '<div class="tooltip grid-tooltip" role="tooltip"><div class="arrow"></div><div class="tooltip-inner"></div></div>'
      }).tooltip('show');
      $this.data('tooltip-initialized', true);
    }
  });
}

function initializeGeneralTooltips() {
  // Initialize tooltips for non-grid elements
  $('[data-bs-toggle="tooltip"]:not(.node-cell)').tooltip({
    boundary: 'window',
    trigger: 'hover',
    placement: 'auto',
    container: 'body'
  }).on('show.bs.tooltip', function () {
    $('[data-bs-toggle="tooltip"]:not(.node-cell)').not(this).tooltip('hide');
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
  $('#node-search').on('input', handleSearch);
  $('.refresh-btn').on('click', loadClusterStatus);

  // Initialize general tooltips
  initializeGeneralTooltips();

  // Start the timestamp updater
  startTimestampUpdater();

  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);

    // Dispose of all tooltips before resize
    $('[data-bs-toggle="tooltip"]').tooltip('dispose');

    resizeTimeout = setTimeout(function () {
      if (rawData) {
        // Store current state before redraw
        const currentGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
          document.querySelector('.mobile-group-select').value;
        const currentSearchTerm = document.getElementById('node-search')?.value || '';

        // Redraw heatmap
        renderHeatmap(rawData);

        // Re-select the current group
        if (currentGroup) {
          switchNodeGroup(currentGroup);
        }

        // Re-apply search if there was one
        if (currentSearchTerm) {
          const searchInput = document.getElementById('node-search');
          searchInput.value = currentSearchTerm;
          searchTerm = currentSearchTerm;
          handleSearch({ target: { value: currentSearchTerm } });
        }

        // After redrawing, reinitialize tooltips
        initializeGridTooltips();
        initializeGeneralTooltips();
      }
    }, 250);
  });

  // First load cluster status which creates the DOM elements
  loadClusterStatus();

  // Add scroll event listener for tabs
  const tabsContainer = document.querySelector('.node-tabs-container > ul');
  if (tabsContainer) {
    tabsContainer.addEventListener('scroll', updateScrollIndicators);

    // Update indicators on window resize
    window.addEventListener('resize', updateScrollIndicators);

    // Initial update
    updateScrollIndicators();
  }
});

// Add this function inside your existing JavaScript
function updateScrollIndicators() {
  const tabsContainer = document.querySelector('.node-tabs');
  const container = document.querySelector('.node-tabs-container');

  if (!tabsContainer || !container) return;

  const hasHorizontalScroll = tabsContainer.scrollWidth > tabsContainer.clientWidth;

  if (!hasHorizontalScroll) {
    container.classList.remove('scroll-start', 'scroll-middle', 'scroll-end');
    return;
  }

  const scrollLeft = tabsContainer.scrollLeft;
  const scrollWidth = tabsContainer.scrollWidth;
  const clientWidth = tabsContainer.clientWidth;

  // Check scroll position
  if (scrollLeft === 0) {
    container.classList.remove('scroll-start', 'scroll-middle');
    container.classList.add('scroll-end');
  } else if (scrollLeft + clientWidth >= scrollWidth - 1) { // -1 for rounding errors
    container.classList.remove('scroll-end', 'scroll-middle');
    container.classList.add('scroll-start');
  } else {
    container.classList.remove('scroll-start', 'scroll-end');
    container.classList.add('scroll-middle');
  }
}
