import { newsFeedUrl } from './config'
import moment from 'moment-timezone';

function format_time(start_time, end_time) {
  if ((end_time - start_time) === 86400000) { // exactly one day
    const text = start_time.format("dddd, MMMM D");
    return `<span title="${start_time.calendar()} - ${end_time.calendar()}">${text}</span>`;
  } else {
    const date_text = start_time.format("dddd, MMMM D");
    return `
        <span>${date_text}</span> ⋅ <span title="${start_time.calendar()}">${start_time.format("LT")}</span> - <span title="${end_time.calendar()}">${end_time.format("LT")}</span>
        `;
  }
}

async function loadNewsFeed() {
  const loadingHtml = `
    <div class="d-flex flex-column align-items-center justify-content-center h-100">
        <div class="position-relative mb-3">
            <div class="spinner-border text-secondary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        <p class="text-muted mb-0">Loading announcements...</p>
    </div>
    `;

  $("#news_feed_card_content").html(loadingHtml);

  return fetch(newsFeedUrl()).then((response) => {
    response.json().then((data) => {
      const articlesHtml = data.map((event) => {
        const start_time = moment(event.dtstart);
        const end_time = moment(event.dtend);
        return `
            <div class="card my-2 me-3">
                <div class="card-body">
                    <h5 class="card-title">${event.summary}</h5>
                    <h6 class="card-subtitle mb-2 text-body-secondary">${format_time(start_time, end_time)}</h6>
                    <p class="card-text">${event.description}</h5>
                </div>
            </div>
            `;
      }).join('');

      // Check if there are any active articles
      /* const hasActiveArticles = sortedData.some(article => article.isActive); */
      const hasActiveArticles = true;

      const noActiveAnnouncementsHtml = hasActiveArticles ? '' : `
            <div class="d-flex flex-column align-items-center justify-content-center py-3 mb-3 bg-light rounded" style="min-height: 250px">
                <div class="mb-3">
                    <i class="fas fa-bullhorn text-muted" style="font-size: 3rem;"></i>
                </div>
                <h5 class="mb-2">No Upcoming Events</h5>
                <p class="text-muted mb-0">This is probably an error. Please <a href="https://help.rit.edu/sp?id=rc_request">contact us.</a></p>
            </div>
            <hr class="my-3">
        `;

      $("#news_feed_card_content").html(articlesHtml);
    }).catch((error) => {
      const errorHtml = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 py-3">
            <div class="text-danger mb-3">
                <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <h5 class="mb-2">Unable to Load Announcements</h5>
            <p class="text-muted small mb-3">There was a problem retrieving the announcements feed</p>
            <button class="btn btn-sm action-btn" 
                    style="background: hsl(0 0% 100%); border: 1px solid hsl(214.3 31.8% 91.4%); color: hsl(222.2 84% 4.9%); border-radius: 8px; padding: 0.5rem 1rem; font-weight: 500; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);"
                    onmouseover="this.style.background='hsl(210 40% 98%)'; this.style.borderColor='hsl(214.3 31.8% 85%)'"
                    onmouseout="this.style.background='hsl(0 0% 100%)'; this.style.borderColor='hsl(214.3 31.8% 91.4%)'"
                    onclick="loadNewsFeed()">
                <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
        </div>
        `;

      $("#news_feed_card_content").html(errorHtml);
      console.error(error);
    });
  });
};

jQuery(() => {
  loadNewsFeed();
});
