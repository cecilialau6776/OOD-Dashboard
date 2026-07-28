import { clusterStatusUrl } from './config'

function getProgressBarColor(ratio) {
  if (ratio < 0.7) return 'bg-success';
  if (ratio < 0.9) return 'bg-warning';
  return 'bg-danger';
}

function getStatusStyle(state) {
  switch (state.toLowerCase()) {
    case 'up':
      return {
        bg: '#dcf5e5',
        text: '#0a6d2c',
        icon: 'fa-check-circle'
      };
    case 'down':
      return {
        bg: '#fde8e8',
        text: '#dc2626',
        icon: 'fa-times-circle'
      };
    case 'drain':
      return {
        bg: '#fff6cc',
        text: '#975810',
        icon: 'fa-exclamation-circle'
      };
    default:
      return {
        bg: '#e5e7eb',
        text: '#4b5563',
        icon: 'fa-question-circle'
      };
  }
}

function loadClusterStatus() {
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

  $("#cluster_status_card_content").html(loadingHtml);

  return fetch(clusterStatusUrl()).then(response => {
    response.json().then(nodes => {
      const counts = {
        onlineUsed: { count: 0, badge_class: "text-bg-success", name: "Online (In Use)" },
        onlineIdle: { count: 0, badge_class: "text-bg-info", name: "Online (Idle)" },
        drained: { count: 0, badge_class: "text-bg-warning", name: "Drained" },
        maintenance: { count: 0, badge_class: "text-bg-secondary", name: "Maintenance" },
        down: { count: 0, badge_class: "text-bg-danger", name: "Down" },
      };
      nodes.forEach(node => {
        if (node.State.includes('DOWN')) {
          counts.down.count++;
        } else if (node.State.includes('DRAIN')) {
          counts.drained.count++;
        } else if (node.State.includes('MAINT')) {
          counts.maintenance.count++;
        } else {
          // Check if node is in use
          const isGPUNode = node.NodeName.startsWith('g');
          const usage = parseInt(node.CPUAlloc) || 0;

          if (usage === 0) {
            counts.onlineIdle.count++;
          } else {
            counts.onlineUsed.count++;
          }
        }
      });

      /* ${acc === "" ? "" : '<div class="col col-12"><hr class="my-2"></div>'} */
      const rowsHtml = Object.keys(counts).reduce((acc, key) => {
        return `${acc}
                    <div class="col col-12">
                        <div class="d-flex py-2${acc === "" ? "" : " border-top"}">
                            <span class="fw-medium">${counts[key]["name"]}</span>
                            <span class="ms-auto align-content-center badge rounded-pill ${counts[key]["badge_class"]}">${counts[key]["count"]}</span>
                        </div>
                    </div>
                `;
      }, "");
      const tableHtml = `
                <div class="row">
                    ${rowsHtml}
                </div>
            `;

      $("#cluster_status_card_content").html(tableHtml);
      setTimeout(() => {
        $('.progress-bar').each(function () {
          $(this).css('width', $(this).attr('aria-valuenow') + '%');
        });
      }, 50);

    });
  }).catch(error => {
    const errorHtml = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100 py-3">
                <div class="text-danger mb-3">
                    <i class="fas fa-exclamation-circle fa-2x"></i>
                </div>
                <h5 class="mb-2">Unable to Load Cluster Status</h5>
                <p class="text-muted small mb-3">There was a problem retrieving the cluster information</p>
                <button class="btn btn-sm action-btn" 
                        style="background: hsl(0 0% 100%); border: 1px solid hsl(214.3 31.8% 91.4%); color: hsl(222.2 84% 4.9%); border-radius: 8px; padding: 0.5rem 1rem; font-weight: 500; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                        onmouseover="this.style.background='hsl(210 40% 98%)'; this.style.borderColor='hsl(214.3 31.8% 85%)'"
                        onmouseout="this.style.background='hsl(0 0% 100%)'; this.style.borderColor='hsl(214.3 31.8% 91.4%)'"
                        onclick="loadClusterStatus">
                    <i class="fas fa-sync-alt me-1"></i> Retry
                </button>
            </div>
            `;

    $("#cluster_status_card_content").html(errorHtml);
    console.error(error);
  });
}

jQuery(() => {
  loadClusterStatus();
});
