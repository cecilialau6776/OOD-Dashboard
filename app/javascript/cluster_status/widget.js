import { clusterStatusUrl } from '../config.js';
import { NODE_STATE_NAME_MAP, getNodeState } from './util.js';

async function loadClusterStatus() {
  $('.refresh-btn i').addClass('refresh-spin');
  fetch(clusterStatusUrl()).then(response => {
    return response.json();
  })
    .then(nodes => {
      const counts = {
        online: 0,
        idle: 0,
        drained: 0,
        maintenance: 0,
        down: 0,
      };
      nodes.forEach(node => {
        counts[getNodeState(node)]++;
      });

      const rowsHtml = Object.keys(counts).reduce((acc, state) => {
        return `${acc}
                    <div class="col col-12" data-state="${state}">
                        <div class="d-flex py-2${acc === "" ? "" : " border-top"}">
                            <span class="fw-medium">${NODE_STATE_NAME_MAP[state]}</span>
                            <span class="ms-auto align-content-center badge rounded-pill">${counts[state]}</span>
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

    })
    .catch(error => {
      $(".error-div[data-widget='parititon-status']").removeClass("d-none");
      console.error(error);
      throw error;
    })
    .finally(() => {
      $(".loading-div").addClass("d-none");
      $('.refresh-btn i').removeClass('refresh-spin');
    });
}

jQuery(() => {
  loadClusterStatus();
  $('.refresh-btn[data-widget="cluster_status"]').on('click', loadClusterStatus);
});
