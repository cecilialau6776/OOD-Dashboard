'use strict';

import Clusterize from 'clusterize.js';
import { clusterStatusUrl, nodeShowUrl } from './config.js';

let rawData = null;
let isInitialLoad = true;
let nodeWidthCache = {};
let listViewCache = {
  rows: {},
  fragments: {}
};
let clusterize = null;
let selectedStates = new Set();

function getNodeColor(node) {
  // Color based on node state
  if (node.State.includes('DOWN')) return '#dc3545';  // red for down nodes
  if (node.State.includes('DRAIN')) return '#ffc107'; // yellow for drained nodes
  if (node.State.includes('MAINT')) return '#fd7e14'; // orange for maintenance

  // Check if node is unused (no cores/GPUs allocated)
  const isGPUNode = node.NodeName.startsWith('g');
  const usage = isGPUNode ?
    (parseInt(node.GPULoad) || 0) :
    (parseInt(node.CPUAlloc) || 0);

  // Return muted green for unused nodes, regular green for used nodes
  return usage === 0 ? '#85c99e' : '#28a745';
}

function getNodeState(state, node) {  // Add node parameter
  if (state.includes('DOWN')) return 'Down';
  if (state.includes('DRAIN')) return 'Drained';
  if (state.includes('MAINT')) return 'Maintenance';

  // For online nodes, check if they're in use
  const isGPUNode = node.NodeName.startsWith('g');
  const usage = isGPUNode ?
    (parseInt(node.GPULoad) || 0) :
    (parseInt(node.CPUAlloc) || 0);

  return usage === 0 ? 'Online (Idle)' : 'Online (In Use)';
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

function renderNodeTabs(nodeGroups) {
  // Create mobile select
  const mobileSelect = document.querySelector('.mobile-group-select');
  const previousValue = mobileSelect.value;  // Store the previous selection
  mobileSelect.innerHTML = '';

  // Create tabs
  const tabsContainer = document.querySelector('.node-tabs');
  tabsContainer.innerHTML = '';

  // Add "All Nodes" option and tab first
  const totalNodes = Object.values(nodeGroups).reduce((sum, nodes) => sum + nodes.length, 0);

  // Add All Nodes to mobile select
  const allOption = document.createElement('option');
  allOption.value = 'All Nodes';
  allOption.textContent = `All Nodes (${totalNodes})`;
  mobileSelect.appendChild(allOption);

  // Add All Nodes tab
  const allTab = document.createElement('div');
  allTab.className = `node-tab ${previousValue === 'All Nodes' || (!previousValue && isInitialLoad) ? 'active' : ''}`;
  allTab.textContent = `All Nodes (${totalNodes})`;
  allTab.onclick = () => switchNodeGroup('All Nodes');
  tabsContainer.appendChild(allTab);

  // Add the rest of the groups
  Object.entries(nodeGroups).forEach(([groupName, nodes]) => {
    // Add option to mobile select
    const option = document.createElement('option');
    option.value = groupName;
    option.textContent = `${groupName} (${nodes.length})`;
    mobileSelect.appendChild(option);

    // Add tab
    const tab = document.createElement('div');
    tab.className = `node-tab ${previousValue === groupName ? 'active' : ''}`;
    tab.textContent = `${groupName} (${nodes.length})`;
    tab.onclick = () => switchNodeGroup(groupName);
    tabsContainer.appendChild(tab);
  });

  // Restore the previous selection or default to All Nodes
  mobileSelect.value = previousValue || 'All Nodes';

  // Remove any existing event listener and add a new one
  mobileSelect.removeEventListener('change', mobileSelectHandler);
  mobileSelect.addEventListener('change', mobileSelectHandler);

  // After creating all tabs, update scroll indicators
  updateScrollIndicators();
}

// Define the mobile select handler outside so we can remove it
function mobileSelectHandler(e) {
  switchNodeGroup(e.target.value);
}

function updateLegendCounts(nodes) {
  const counts = {
    onlineUsed: 0,
    onlineIdle: 0,
    drained: 0,
    maintenance: 0,
    down: 0
  };

  nodes.forEach(node => {
    if (node.State.includes('DOWN')) {
      counts.down++;
    } else if (node.State.includes('DRAIN')) {
      counts.drained++;
    } else if (node.State.includes('MAINT')) {
      counts.maintenance++;
    } else {
      // Check if node is in use
      const isGPUNode = node.NodeName.startsWith('g');
      const usage = isGPUNode ?
        (parseInt(node.GPULoad) || 0) :
        (parseInt(node.CPUAlloc) || 0);

      if (usage === 0) {
        counts.onlineIdle++;
      } else {
        counts.onlineUsed++;
      }
    }
  });

  // Update the count spans
  const statusCounts = document.querySelectorAll('.status-count');
  statusCounts[0].textContent = `(${counts.onlineUsed})`;
  statusCounts[1].textContent = `(${counts.onlineIdle})`;
  statusCounts[2].textContent = `(${counts.drained})`;
  statusCounts[3].textContent = `(${counts.maintenance})`;
  statusCounts[4].textContent = `(${counts.down})`;
}

function switchNodeGroup(groupName) {
  // Store current search term
  const currentSearchTerm = document.getElementById('node-search')?.value || '';

  // Update tabs
  document.querySelectorAll('.node-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.textContent.startsWith(groupName)) {
      tab.classList.add('active');
    }
  });

  // Update mobile select
  document.querySelector('.mobile-group-select').value = groupName;

  // Update grid view
  document.querySelectorAll('.node-group').forEach(group => {
    group.classList.remove('active');
    if (group.id === `group-${groupName.replace(/\s+/g, '-')}`) {
      group.classList.add('active');
    }
  });

  // Get nodes for the selected group
  let nodes;
  if (groupName === 'All Nodes') {
    nodes = rawData;
  } else {
    nodes = rawData.filter(node => {
      const prefix = node.NodeName.match(/^[a-z]+/i)?.[0] || 'other';
      const nodeGroupName = prefix === 'login' ? 'Login Nodes' :
        `${prefix.toUpperCase()} Nodes`;
      return nodeGroupName === groupName;
    });
  }

  // If there's a search term, filter the nodes
  if (currentSearchTerm) {
    nodes = nodes.filter(node => nodeMatchesSearch(node, currentSearchTerm));
  }

  // Apply current sort if one exists
  if (currentSort.column) {
    nodes = sortNodes(nodes, currentSort.column, currentSort.direction);
    updateSortIndicators(currentSort.column, currentSort.direction);
  }

  // Update legend counts with filtered and sorted nodes
  updateLegendCounts(nodes);

  // Render the list view
  renderListView(nodes);
}

function renderHeatmap(data) {
  const nodesArray = Array.isArray(data) ? data : Object.values(data);

  // Group nodes by type
  const nodeGroups = nodesArray.reduce((groups, node) => {
    const prefix = node.NodeName.match(/^[a-z]+/i)?.[0] || 'other';
    const groupName = prefix === 'login' ? 'Login Nodes' :
      `${prefix.toUpperCase()} Nodes`;

    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(node);
    return groups;
  }, {});

  // Clear previous visualization
  const heatmapContainer = document.getElementById('heatmap');
  heatmapContainer.innerHTML = "";

  // Render tabs first
  renderNodeTabs(nodeGroups);

  // Create container for node groups
  const container = document.createElement('div');
  container.className = 'node-groups-container mt-3';

  // Create All Nodes group first
  const allNodesGroup = document.createElement('div');
  allNodesGroup.className = 'node-group active';
  allNodesGroup.id = 'group-All-Nodes';

  // Create grid for All Nodes
  const allNodesGrid = createNodeGrid(nodesArray);
  allNodesGroup.appendChild(allNodesGrid);
  container.appendChild(allNodesGroup);

  // Create other groups
  Object.entries(nodeGroups).forEach(([groupName, nodes]) => {
    const group = document.createElement('div');
    group.className = 'node-group';
    group.id = `group-${groupName.replace(/\s+/g, '-')}`;

    // Create grid for this group
    const grid = createNodeGrid(nodes);
    group.appendChild(grid);
    container.appendChild(group);
  });

  heatmapContainer.appendChild(container);

  // Initialize tooltips for the grid nodes
  initializeGridTooltips();
}

// Add this new helper function to create the node grid
function createNodeGrid(nodes) {
  const container = document.createElement('div');
  container.className = 'row g-2';

  // Create temporary span once
  const tempSpan = document.createElement('span');
  tempSpan.className = 'node-label text-white';
  tempSpan.style.position = 'absolute';
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.whiteSpace = 'nowrap';
  document.body.appendChild(tempSpan);

  const fragment = document.createDocumentFragment(); // Use document fragment for better performance

  nodes.forEach(node => {
    const col = document.createElement('div');
    col.className = 'col-auto';

    const nodeCell = document.createElement('div');
    nodeCell.className = 'node-cell d-flex align-items-center justify-content-center';

    // Get cached width or calculate it
    const nodeName = node.NodeName;
    let cellWidth;

    if (nodeName.length === 4) {
      cellWidth = 45;
    } else {
      if (!nodeWidthCache[nodeName]) {
        tempSpan.textContent = nodeName;
        const textWidth = tempSpan.offsetWidth;
        nodeWidthCache[nodeName] = Math.max(45, textWidth + 20);
      }
      cellWidth = nodeWidthCache[nodeName];
    }

    nodeCell.style.width = `${cellWidth}px`;
    nodeCell.style.height = '45px';
    nodeCell.style.backgroundColor = getNodeColor(node);
    nodeCell.style.borderRadius = '4px';

    const label = document.createElement('span');
    label.className = 'node-label text-white small font-weight-500';
    label.textContent = nodeName;
    nodeCell.appendChild(label);

    // Store tooltip content as data attribute instead of initializing tooltip
    nodeCell.setAttribute('data-bs-toggle', 'tooltip');
    nodeCell.setAttribute('data-bs-html', 'true');
    nodeCell.setAttribute('title', createNodeTooltip(node));

    nodeCell.addEventListener('click', (event) => {
      event.preventDefault();
      const url = nodeShowUrl(nodeName);

      if (event.metaKey || event.ctrlKey) {
        window.open(url, '_blank');
      } else if (event.shiftKey) {
        window.open(url, '_blank', 'toolbar=yes,location=yes,status=yes,menubar=yes,scrollbars=yes');
      } else {
        window.location.href = url;
      }
    });

    col.appendChild(nodeCell);
    fragment.appendChild(col); // Append to fragment instead of container
  });

  container.appendChild(fragment); // Append fragment to container once
  document.body.removeChild(tempSpan);

  return container;
}

// Add this helper function to create the tooltip content
function createNodeTooltip(node) {
  const isGPUNode = parseInt(node.GPUTot) && parseInt(node.GPUTot) > 0;

  const cpuAlloc = parseInt(node.CPUAlloc) || 0;
  const cpuTotal = parseInt(node.CPUTot) || 0;
  const gpuLoad = parseInt(node.GPULoad) || 0;
  const gpuTotal = parseInt(node.GPUTot) || 0;

  const totalMem = parseInt(node.RealMemory) || 0;
  const allocMem = parseInt(node.AllocMem) || 0;

  const partitions = node.Partitions || [];

  const nodeState = getNodeState(node.State, node);
  const stateColor = nodeState.startsWith('Online') ? 'success' :  // Both Online states use success
    nodeState === 'Drained' ? 'warning' :
      nodeState === 'Maintenance' ? 'orange' : 'danger';

  return `
      <div class="text-start">
        <strong>${node.NodeName}</strong><br>
        <span class="text-${stateColor}">
          ${nodeState}
        </span><br>
        ${isGPUNode ? `GPUs: ${gpuLoad}/${gpuTotal}<br>` : `CPUs: ${cpuAlloc}/${cpuTotal}<br>`}
        Memory: ${formatMemory(allocMem)}/${formatMemory(totalMem)}<br>
        Partitions: ${partitions.join(', ')}
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
  if (getNodeState(node.State, node).toLowerCase().includes(term)) return true;

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

  // Update legend counts with filtered nodes
  updateLegendCounts(filteredNodes);

  // Apply current sort if any
  const sortedNodes = currentSort.column ?
    sortNodes(filteredNodes, currentSort.column, currentSort.direction) :
    filteredNodes;

  // Render the filtered and sorted nodes
  renderListView(sortedNodes);
}

function renderListView(data) {
  const nodesArray = Array.isArray(data) ? data : Object.values(data);

  // Update compute header if needed
  if (nodesArray.length > 0) {
    const isGPUNode = nodesArray[0].NodeName.startsWith('g');
    document.querySelector('.compute-header').textContent =
      isGPUNode ? 'GPUs (Used/Total)' : 'CPU cores (Used/Total)';
  }

  // Generate row data
  let rows;
  if (nodesArray.length === 0 && searchTerm) {
    rows = [`<tr>
        <td colspan="5">
          <div class="no-results">
            <i class="fas fa-search mb-2"></i>
            <p class="mb-0">No nodes match your search</p>
          </div>
        </td>
      </tr>`];
  } else {
    rows = nodesArray.map(node => {
      return `<tr class="clusterize-row">
          ${createRowHTML(node)}
        </tr>`;
    });
  }

  // Initialize or update Clusterize
  if (!clusterize) {
    clusterize = new Clusterize({
      rows: rows,
      scrollId: 'clusterize-scroll',
      contentId: 'clusterize-content',
      rows_in_block: 50,
      blocks_in_cluster: 4,
      show_no_data_row: false
    });
  } else {
    clusterize.update(rows);
  }
}

function createRowHTML(node) {
  const isGPUNode = node.NodeName.startsWith('g');
  const nodeState = getNodeState(node.State, node);
  const stateClass = nodeState.startsWith('Online') ? 'online' :
    nodeState === 'Drained' ? 'drained' :
      nodeState === 'Maintenance' ? 'maintenance' : 'down';

  const computeUsed = isGPUNode ? (parseInt(node.GPULoad) || 0) : (parseInt(node.CPUAlloc) || 0);
  const computeTotal = isGPUNode ? (parseInt(node.GPUTot) || 1) : (parseInt(node.CPUTot) || 1);
  const computePercentage = Math.min(100, Math.round((computeUsed / computeTotal) * 100));

  const totalMem = parseInt(node.RealMemory) || 1;
  const allocMem = parseInt(node.AllocMem) || 0;
  const memPercentage = Math.min(100, Math.round((allocMem / totalMem) * 100));

  const partitionBadges = (node.Partitions || [])
    .map(partition => `<span class="partition-badge">${partition}</span>`)
    .join(' ');

  const nodeUrl = nodeShowUrl(node.nodeName);

  return `
      <td>
        <a href="${nodeUrl}" 
           class="node-name-link"
           onclick="handleNodeClick(event, '${node.NodeName}')">${node.NodeName}</a>
      </td>
      <td><span class="node-state ${stateClass}">${nodeState}</span></td>
      <td>${partitionBadges}</td>
      <td>
        <div class="usage-container">
          <div class="progress">
            <div class="progress-bar" style="width: ${computePercentage}%; background-color: #1a73e8;"></div>
          </div>
          <div class="progress-text">${computeUsed}/${computeTotal} ${isGPUNode ? 'GPUs' : 'CPU cores'}</div>
        </div>
      </td>
      <td>
        <div class="usage-container">
          <div class="progress">
            <div class="progress-bar" style="width: ${memPercentage}%; background-color: #1a73e8;"></div>
          </div>
          <div class="progress-text">${formatMemory(allocMem)}/${formatMemory(totalMem)}</div>
        </div>
      </td>
    `;
}

function handleNodeClick(event, nodeName) {
  const url = nodeShowUrl(nodeName);

  if (event.metaKey || event.ctrlKey) {
    window.open(url, '_blank');
  } else if (event.shiftKey) {
    window.open(url, '_blank', 'toolbar=yes,location=yes,status=yes,menubar=yes,scrollbars=yes');
  } else {
    window.location.href = url;
  }
  event.preventDefault();
}

function switchView(viewType) {
  // Remove event handlers when switching away from grid view
  if (viewType !== 'heatmap') {
    $('#heatmap').off('mouseenter', '.node-cell');
  }

  // Update view containers
  document.querySelectorAll('.view-container').forEach(container => {
    if (container.id === viewType) {
      container.classList.add('active');
      // Only initialize tooltips for the active view
      if (viewType === 'heatmap') {
        initializeGridTooltips();
      }
    } else {
      container.classList.remove('active');
      // Dispose tooltips for the inactive view
      $(container).find('[data-bs-toggle="tooltip"]').tooltip('dispose');
    }
  });

  // Update button states
  const buttons = document.querySelectorAll('.view-toggle-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (viewType === 'heatmap') {
    document.querySelector('#heatmapViewBtn').classList.add('active');
    // Only re-render if the grid is empty
    if (!document.querySelector('#heatmap .node-groups-container')) {
      renderHeatmap(rawData);
      const currentGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
        document.querySelector('.mobile-group-select').value;
      if (currentGroup) {
        switchNodeGroup(currentGroup);
      }
    }
  } else if (viewType === 'listview') {
    document.querySelector('#listViewBtn').classList.add('active');
    const currentGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
      document.querySelector('.mobile-group-select').value;
    if (currentGroup) {
      switchNodeGroup(currentGroup);
    }
    syncHorizontalScroll(); // Add scroll synchronization
  } else {
    // Destroy Clusterize instance when switching away from list view
    if (clusterize) {
      clusterize.destroy(true);
      clusterize = null;
    }
  }

  // Keep general tooltips initialized
  initializeGeneralTooltips();
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

      desktopSpan.setAttribute('title', absoluteTime);
      mobileSpan.setAttribute('title', absoluteTime);

      // Keep the dotted underline
      desktopSpan.style.borderBottom = '1px dotted #666';
      mobileSpan.style.borderBottom = '1px dotted #666';

      // Reinitialize tooltips
      $('[data-bs-toggle="tooltip"]').tooltip('dispose').tooltip();
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
  // Clear selected states when refreshing
  selectedStates.clear();
  document.querySelectorAll('.status-indicator').forEach(indicator => {
    indicator.classList.remove('selected');
  });

  // Clear caches when refreshing data
  listViewCache = { rows: {}, fragments: {} };

  // Destroy existing Clusterize instance
  if (clusterize) {
    clusterize.destroy(true);
    clusterize = null;
  }

  // Store current sort state before refresh
  const previousSort = {
    column: currentSort.column,
    direction: currentSort.direction
  };

  // Start refresh button animation
  const refreshIcon = document.querySelector('#refresh-button i');
  refreshIcon.classList.add('refresh-spin');

  // Only show loading animation on initial load
  if (isInitialLoad) {
    const loadingHtml = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100">
          <div class="position-relative mb-3">
            <div class="spinner-border text-secondary" style="width: 3rem; height: 3rem;" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <p class="text-muted mb-0">Loading cluster status...</p>
        </div>
      `;
    $("#cluster_status_content").html(loadingHtml);
  }

  // Store current state if not initial load
  const currentView = !isInitialLoad ? document.querySelector('.view-container.active').id : 'heatmap';
  const currentGroup = !isInitialLoad ? (document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
    document.querySelector('.mobile-group-select').value) : null;
  const currentSearchTerm = !isInitialLoad ? document.getElementById('node-search')?.value : '';

  return fetch(clusterStatusUrl()).then(res => {
    return res.json();
  }).then(data => {
      // Stop refresh button animation
      refreshIcon.classList.remove('refresh-spin');

      // Store the current time as the last update time
      window.lastUpdatedTime = new Date();

      // Update timestamp display and start auto-updating
      formatLastUpdated();
      startTimestampUpdater();

      rawData = data;

      if (isInitialLoad) {
        // Initial load - rebuild full DOM
        $("#cluster_status_content").html(`
            <div class="node-tabs-container mb-3">
              <select class="mobile-group-select form-select"></select>
              <div class="node-tabs"></div>
            </div>
            <div id="heatmap" class="view-container active"></div>
            <div id="listview" class="view-container">
              <div class="table-responsive">
                <div class="search-container mb-3">
                  <div class="input-group">
                    <span class="input-group-text bg-white border-end-0">
                      <i class="fas fa-search text-muted"></i>
                    </span>
                    <input type="text" 
                           id="node-search" 
                           class="form-control border-start-0" 
                           placeholder="Search nodes..."
                           aria-label="Search nodes">
                  </div>
                </div>
                <table class="table table-hover" id="nodes-table">
                  <thead>
                    <tr>
                      <th class="sortable" data-sort="name" style="cursor: pointer;">
                        Node
                        <i class="fas fa-sort text-muted ms-1"></i>
                      </th>
                      <th class="sortable" data-sort="state" style="cursor: pointer;">
                        State
                        <i class="fas fa-sort text-muted ms-1"></i>
                      </th>
                      <th class="sortable" data-sort="partitions" style="cursor: pointer;">
                        Partitions
                        <i class="fas fa-sort text-muted ms-1"></i>
                      </th>
                      <th class="sortable" data-sort="compute" style="cursor: pointer;">
                        <span class="compute-header">CPU cores (Used/Total)</span>
                        <i class="fas fa-sort text-muted ms-1"></i>
                      </th>
                      <th class="sortable" data-sort="memory" style="cursor: pointer;">
                        Memory (Used/Total)
                        <i class="fas fa-sort text-muted ms-1"></i>
                      </th>
                    </tr>
                  </thead>
                </table>
                <div id="clusterize-scroll" class="clusterize-scroll">
                  <table class="table table-hover">
                    <tbody id="clusterize-content" class="clusterize-content">
                      <!-- Clusterize.js will manage this content -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `);

        // Set up initial event handlers
        document.getElementById('heatmapViewBtn').addEventListener('click', (e) => {
          e.preventDefault();
          switchView('heatmap');
        });

        document.getElementById('listViewBtn').addEventListener('click', (e) => {
          e.preventDefault();
          switchView('listview');
        });

        // Add click handlers for sorting
        document.querySelectorAll('th.sortable').forEach(th => {
          th.addEventListener('click', () => {
            handleSort(th.dataset.sort);
          });
        });

        // Add search handler
        document.getElementById('node-search').addEventListener('input', handleSearch);
      }

      // Update both views
      renderHeatmap(data);

      // Handle list view update
      if (isInitialLoad) {
        // On initial load, get the first group's nodes and render them
        const firstTab = document.querySelector('.node-tab');
        if (firstTab) {
          firstTab.click(); // This will trigger switchNodeGroup with the first group
        }
        isInitialLoad = false;
      } else {
        // After refresh, re-click the current tab to maintain state
        const tabs = document.querySelectorAll('.node-tab');
        tabs.forEach(tab => {
          if (tab.textContent.startsWith(currentGroup)) {
            tab.click();
            return;
          }
        });

        // Re-apply search if there was one
        if (currentSearchTerm) {
          const searchInput = document.getElementById('node-search');
          searchInput.value = currentSearchTerm;
          searchTerm = currentSearchTerm;
          handleSearch({ target: { value: currentSearchTerm } });
        }
      }

      // Reapply sort if there was one
      if (previousSort.column) {
        currentSort = { ...previousSort }; // Make a copy to ensure clean state
        updateSortIndicators(currentSort.column, currentSort.direction); // Update indicators first
        handleSort(previousSort.column, true); // Add skipDirectionToggle parameter
      }

      return data;
    })
    .catch(error => {
      // Stop refresh button animation
      refreshIcon.classList.remove('refresh-spin');

      console.error('Error:', error);
      const errorHtml = `
          <div class="d-flex flex-column align-items-center justify-content-center h-100 py-3">
            <div class="text-danger mb-3">
              <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <h5 class="mb-2">Unable to Load Cluster Status</h5>
            <p class="text-muted small mb-3">There was a problem retrieving the cluster status</p>
            <button class="btn btn-sm btn-outline-secondary rounded-pill shadow-sm" onclick="loadClusterStatus(true)">
              <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
          </div>
        `;
      $("#cluster_status_content").html(errorHtml);
      throw error;
    });
}

let currentSort = {
  column: null,
  direction: 'asc'
};

function compareValues(a, b, isAsc) {
  // Handle null/undefined values
  if (a === null || a === undefined) return isAsc ? -1 : 1;
  if (b === null || b === undefined) return isAsc ? 1 : -1;

  // Handle numeric values
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * (isAsc ? 1 : -1);
  }

  // Handle string values
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b) * (isAsc ? 1 : -1);
  }

  // Fallback comparison
  return ((a < b ? -1 : 1) * (isAsc ? 1 : -1));
}

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
      return statePriority[getNodeState(node.State)];
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

function updateSortIndicators(column, direction) {
  // First reset all icons to default
  document.querySelectorAll('th.sortable i').forEach(icon => {
    icon.className = 'fas fa-sort text-muted ml-1';
  });

  // Then update the current sort column's icon
  if (column) {
    const th = document.querySelector(`th[data-sort="${column}"]`);
    if (th) {
      const icon = th.querySelector('i');
      icon.className = `fas fa-sort-${direction === 'asc' ? 'up' : 'down'} ml-1`;
    }
  }
}

function handleSort(column, skipDirectionToggle = false) {
  if (currentSort.column === column && !skipDirectionToggle) {
    // If clicking the same column, toggle direction
    currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
  } else {
    // If clicking a new column or restoring previous sort, set column and keep/set direction
    if (!skipDirectionToggle) {
      currentSort.direction = 'desc'; // New column starts with desc
    }
    currentSort.column = column;
  }

  updateSortIndicators(currentSort.column, currentSort.direction);

  // Get current group name
  const activeGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
    document.querySelector('.mobile-group-select').value;

  // Get nodes for current group
  let nodes;
  if (activeGroup === 'All Nodes') {
    nodes = [...rawData]; // Create a copy of the array
  } else {
    nodes = rawData.filter(node => {
      const prefix = node.NodeName.match(/^[a-z]+/i)?.[0] || 'other';
      const nodeGroupName = prefix === 'login' ? 'Login Nodes' :
        `${prefix.toUpperCase()} Nodes`;
      return nodeGroupName === activeGroup;
    });
  }

  // Apply search filter if there's a search term
  if (searchTerm) {
    nodes = nodes.filter(node => nodeMatchesSearch(node, searchTerm));
  }

  // Sort the nodes
  const sortedNodes = sortNodes(nodes, currentSort.column, currentSort.direction);

  // Update legend counts with filtered and sorted nodes
  updateLegendCounts(sortedNodes);

  // Render the view
  renderListView(sortedNodes);
}

// Update the click handlers for sorting
function initializeSortHandlers() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      handleSort(column);
    });
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

function initializeStatusFilters() {
  document.querySelectorAll('.status-indicator').forEach(indicator => {
    indicator.addEventListener('click', (e) => {
      const state = indicator.querySelector('.status-indicator-label').textContent.trim().toLowerCase();

      if (selectedStates.has(state)) {
        selectedStates.delete(state);
        indicator.classList.remove('selected');
      } else {
        selectedStates.add(state);
        indicator.classList.add('selected');
      }

      applyStateFilters();
    });
  });
}

function applyStateFilters() {
  // Get current group name
  const currentGroup = document.querySelector('.node-tab.active')?.textContent.split(' (')[0] ||
    document.querySelector('.mobile-group-select').value;

  // Get nodes for current group
  let nodes;
  if (currentGroup === 'All Nodes') {
    nodes = [...rawData];
  } else {
    nodes = rawData.filter(node => {
      const prefix = node.NodeName.match(/^[a-z]+/i)?.[0] || 'other';
      const nodeGroupName = prefix === 'login' ? 'Login Nodes' :
        `${prefix.toUpperCase()} Nodes`;
      return nodeGroupName === currentGroup;
    });
  }

  // Apply state filter if there are selected states
  if (selectedStates.size > 0) {
    nodes = nodes.filter(node => {
      const nodeState = getNodeState(node.State, node).toLowerCase();
      return selectedStates.has(nodeState);
    });
  }

  // Apply search filter if there's a search term
  if (searchTerm) {
    nodes = nodes.filter(node => nodeMatchesSearch(node, searchTerm));
  }

  // Apply current sort if any
  if (currentSort.column) {
    nodes = sortNodes(nodes, currentSort.column, currentSort.direction);
  }

  // Update legend counts with filtered nodes
  updateLegendCounts(nodes);

  // Update the current view
  const currentView = document.querySelector('.view-container.active').id;
  if (currentView === 'heatmap') {
    renderHeatmap(nodes);
  } else {
    renderListView(nodes);
  }
}

// Initialize tooltips and handle window resize
document.addEventListener('DOMContentLoaded', function () {
  // Initialize general tooltips
  initializeGeneralTooltips();

  // Start the timestamp updater
  startTimestampUpdater();

  // Initialize status filters
  initializeStatusFilters();

  // Handle clicking outside tooltips
  $(document).on('click', function (event) {
    if (!$(event.target).closest('[data-bs-toggle="tooltip"]').length) {
      $('[data-bs-toggle="tooltip"]').tooltip('hide');
    }
  });

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
        const currentView = document.querySelector('.view-container.active').id;
        const currentSearchTerm = document.getElementById('node-search')?.value || '';

        // Redraw heatmap
        renderHeatmap(rawData);

        // Restore the current view and state
        if (currentView === 'listview') {
          switchView('listview');
        } else {
          switchView('heatmap');
        }

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
  loadClusterStatus().then(() => {
    // After the DOM elements are created, set up view switching
    document.getElementById('heatmapViewBtn').addEventListener('click', (e) => {
      e.preventDefault();
      switchView('heatmap');
    });

    document.getElementById('listViewBtn').addEventListener('click', (e) => {
      e.preventDefault();
      switchView('listview');
    });

    // Always start in grid view
    switchView('heatmap');

    // Add click handlers for sorting
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        handleSort(th.dataset.sort);
      });
    });

    // Add search handler
    document.getElementById('node-search').addEventListener('input', handleSearch);

    // Initialize sort handlers
    initializeSortHandlers();
  }).catch(error => {
    console.error('Failed to initialize view:', error);
  });

  // Add refresh button click handler
  document.getElementById('refresh-button').addEventListener('click', () => {
    loadClusterStatus();
  });

  // Update the refresh icon selector
  const refreshIcon = document.querySelector('#refresh-button i');

  // Add scroll event listener for tabs
  const tabsContainer = document.querySelector('.node-tabs');
  if (tabsContainer) {
    tabsContainer.addEventListener('scroll', updateScrollIndicators);

    // Update indicators on window resize
    window.addEventListener('resize', updateScrollIndicators);

    // Initial update
    updateScrollIndicators();
  }
});

// Add this JavaScript function to handle scroll synchronization
function syncHorizontalScroll() {
  const scrollArea = document.getElementById('clusterize-scroll');
  const headerTable = document.getElementById('nodes-table');

  scrollArea.addEventListener('scroll', function () {
    headerTable.style.transform = `translateX(-${this.scrollLeft}px)`;
  });
}

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
