import { gpuHourSummaryUrl, accountListUrl } from './config'

function download_balance_summary(allocation, type, total_sus_used, total_sus_limit) {
  var BALANCE_SUMMARY_COLUMNS = ["Username", "SUs Used", "SU Limit"];

  const $button = $(`#${allocation}-export-dropdown-button`);
  const $icon = $button.find('i.fas');

  // Disable the button and save original icon class
  $button.prop('disabled', true);
  const originalIconClass = $icon.attr('class');

  // Replace icon with spinner
  $icon.removeClass().addClass('spinner-border spinner-border-sm');

  fetch(`${gpuHourSummaryUrl()}?allocation=${encodeURIComponent(allocation)}`).then(response => {
    response.json().then(data => {
      var EXPORT_TYPES = { "CSV": "csv", "Excel": "xlsx" };
      if (data.length === 0) {
        toastr.error("No data to export");
      } else if (Object.keys(EXPORT_TYPES).includes(type)) {
        toastr.info(`Exporting ${data.length} row(s) as ${type}...`);

        // Create the export data with total SUs in a table format
        const exportData = [
          ["Allocation", "Total GPU Hours Used", "Total GPU Hours Limit", "Generated At (UTC)"],
          [allocation,
            total_sus_used.toLocaleString(),
            total_sus_limit === "No limit" ? "No limit" : total_sus_limit.toLocaleString(),
            new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
          ],
          [], // Empty row for spacing
          BALANCE_SUMMARY_COLUMNS,
          ...data.map(row => Object.values(row))
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        var workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, `<%= Configuration.cluster_name %>_service_units_${allocation}_${Date.now()}.${EXPORT_TYPES[type]}`, { compression: true });
      } else {
        toastr.error("Invalid export file type");
      }
    });
  }).catch(error => {
    toastr.error("Failed to export allocation service unit usage!");
    console.error(error);
  }).finally(() => {
    // Restore original icon and re-enable button
    $icon.removeClass().addClass(originalIconClass);
    $button.prop('disabled', false);
  });
}

function formatLargeNumber(num, decimals = 1) {
  const fullNum = num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(decimals);
    const isExact = num === Math.round(num / 1000000) * 1000000;
    const style = isExact ? '' : ' style="border-bottom: 1px dotted #6c757d; cursor: help" data-bs-toggle="tooltip" data-bs-trigger="hover click"';
    return `<span${style} title="${isExact ? '' : fullNum}">${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M</span>`;
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(decimals);
    const isExact = num === Math.round(num / 1000) * 1000;
    const style = isExact ? '' : ' style="border-bottom: 1px dotted #6c757d; cursor: help" data-bs-toggle="tooltip" data-bs-trigger="hover click"';
    return `<span${style} title="${isExact ? '' : fullNum}">${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}K</span>`;
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function loadAccountList() {
  const loadingHtml = `
            <div class="d-flex flex-column align-items-center justify-content-center h-100">
                <div class="position-relative mb-3">
                    <div class="spinner-border text-secondary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
                <p class="text-muted mb-0">Loading account data...</p>
            </div>
        `;

  $("#account_list_card_content").html(loadingHtml);

  return fetch(accountListUrl()).then(response => {
    response.json().then(data => {
      let tableHtml;
      if (data.length === 0) {
        tableHtml = '<div class="h5 mb-2">No allocations available</div>';
      } else {
        const tableRowsHtml = data.toSorted((a, b) => b["project_id"] - a["project_id"])
          .map((row) => {
            const proj_id = row["project_id"];
            const defaultQos = row.qos.filter((qos) => qos.is_default)[0];
            const rowHeader = "project_id" in row ? `<a href="https://coldfront.rc.rit.edu/project/${row.project_id}/" title="View in ColdFront" target="_blank">${row.name}</a>` : row.name
            const rowHtml = `
                    <tr>
                        <th scope="row">${rowHeader}</th>
                        <td>${row["cluster"].toUpperCase()}</td>
                        <td>${defaultQos?.name ?? "N/A"}</td>
                    </tr>
                    `;
            return rowHtml;
          }).join("");
        tableHtml = `
                <table class="table">
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Cluster</th>
                            <th scope="col">QOS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
                `;
      }

      $("#account_list_card_content").html(tableHtml);
      // Add small delay to trigger animation
      setTimeout(() => {
        $('.progress-bar').each(function () {
          $(this).css('width', $(this).attr('aria-valuenow') + '%');
        });
      }, 50);

      $('[data-bs-toggle="tooltip"]').tooltip({
        boundary: 'window',
        trigger: 'hover click'
      }).on('show.bs.tooltip', function () {
        // Hide all other tooltips
        $('[data-bs-toggle="tooltip"]').not(this).tooltip('hide');
      });

      // Hide tooltips when clicking anywhere else on the document
      $(document).on('click', function (event) {
        if (!$(event.target).closest('[data-bs-toggle="tooltip"]').length) {
          $('[data-bs-toggle="tooltip"]').tooltip('hide');
        }
      });

      $('div.gpu-hour-export-dropdown .dropdown-item').on("click", function () {
        const $dropdown = $(this).parent();
        const allocation = $dropdown.data("account");
        const total_gpu_hours_used = $dropdown.data("total-gpu-hours-used");
        const total_gpu_hours_limit = $dropdown.data("total-gpu-hours-limit");
        // Extract just the text content, removing any HTML and trimming whitespace
        const exportType = $(this).text().trim();
        download_balance_summary(allocation, exportType, total_gpu_hours_used, total_gpu_hours_limit);
      });
    });
  }).catch(error => {
    const errorHtml = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 py-3">
                    <div class="text-danger mb-3">
                        <i class="fas fa-exclamation-circle fa-2x"></i>
                    </div>
                    <h5 class="mb-2">Unable to Load Account List</h5>
                    <p class="text-muted small mb-3">There was a problem retrieving your account information</p>
                    <button class="btn btn-sm action-btn" 
                            style="background: hsl(0 0% 100%); border: 1px solid hsl(214.3 31.8% 91.4%); color: hsl(222.2 84% 4.9%); border-radius: 8px; padding: 0.5rem 1rem; font-weight: 500; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                            onmouseover="this.style.background='hsl(210 40% 98%)'; this.style.borderColor='hsl(214.3 31.8% 85%)'"
                            onmouseout="this.style.background='hsl(0 0% 100%)'; this.style.borderColor='hsl(214.3 31.8% 91.4%)'"
                            onclick="loadAccountList">
                        <i class="fas fa-sync-alt me-1"></i> Retry
                    </button>
                </div>
            `;

    $("#account_list_card_content").html(errorHtml);
    console.error(error);
  });
}

jQuery(() => {
  loadAccountList();
});
